package rendering

// @description BMC Custom code
// @author kmejdi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"path/filepath"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana/pkg/infra/metrics"
	reporting_scheduler "github.com/grafana/grafana/pkg/services/scheduler"
	"github.com/grafana/grafana/pkg/setting"
)

type customPDFFunc func(ctx context.Context, renderKey string, options CustomPDFOpts) (*RenderResult, error)
type customCSVFunc func(ctx context.Context, renderKey string, options CustomCSVOpts) (*RenderResult, error)
type customXLSFunc func(ctx context.Context, renderKey string, options CustomXLSOpts) (*RenderResult, error)
type customPanelIDFunc func(ctx context.Context, renderKey string, options CustomGetRepeatedPanelsOpts) (*RenderResult, error)

type CustomPDFOpts struct {
	TimeoutOpts
	AuthOpts
	Path              string
	Encoding          string
	Timezone          string
	ConcurrentLimit   int
	DeviceScaleFactor float64
	Headers           map[string][]string

	UID         string
	ReportName  string
	Description string
	From        string
	To          string
	CompanyLogo string
	FooterText  string
	FooterURL   string
	Theme       string
	Layout      string
	Orientation string
	DateFormat  string
	Variables   string
	ShowRepeat  string
}

type CustomCSVOpts struct {
	TimeoutOpts
	AuthOpts
	Path            string
	Encoding        string
	Timezone        string
	ConcurrentLimit int
	Headers         map[string][]string

	UID             string
	PanelId         string
	From            string
	To              string
	Variables       string
	CSVDelimiter    string
	EnableOverrides string
	HideHeader      string
	Enclosed        string
	Newline         string
}

type CustomXLSOpts struct {
	TimeoutOpts
	AuthOpts
	Path            string
	Encoding        string
	Timezone        string
	ConcurrentLimit int
	Headers         map[string][]string

	UID       string
	PanelId   string
	From      string
	To        string
	Variables string
}

type CustomGetRepeatedPanelsOpts struct {
	TimeoutOpts
	AuthOpts
	Path            string
	Encoding        string
	Timezone        string
	ConcurrentLimit int
	Headers         map[string][]string

	UID        string
	From       string
	To         string
	Variables  string
	ShowRepeat string
}

func (rs *RenderingService) customPDFViaHTTP(ctx context.Context, renderKey string, opts CustomPDFOpts) (*RenderResult, error) {
	filePath, err := rs.getNewFilePath(RenderPDF)
	if err != nil {
		return nil, err
	}

	rendererURL, err := url.Parse(rs.Cfg.RendererUrl + "/pdf")
	if err != nil {
		return nil, err
	}

	opts.Path = rs.getDashURL(opts.UID, opts.OrgID, opts.From, opts.To, opts.Variables)
	opts.Path = opts.Path + "&showRepeat=true"
	queryParams := rendererURL.Query()
	queryParams.Add("renderKey", renderKey)
	queryParams.Add("domain", rs.domain)
	queryParams.Add("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	queryParams.Add("encoding", opts.Encoding)
	queryParams.Add("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))
	queryParams.Add("deviceScaleFactor", fmt.Sprintf("%f", opts.DeviceScaleFactor))

	queryParams.Add("url", opts.Path)
	queryParams.Add("name", opts.ReportName)
	queryParams.Add("description", opts.Description)
	queryParams.Add("from", opts.From)
	queryParams.Add("to", opts.To)
	// queryParams.Add("companyLogo", opts.CompanyLogo)
	queryParams.Add("footerText", opts.FooterText)
	queryParams.Add("footerURL", opts.FooterURL)
	queryParams.Add("theme", string(opts.Theme))
	queryParams.Add("layout", opts.Layout)
	queryParams.Add("orientation", opts.Orientation)
	queryParams.Add("dateFormat", opts.DateFormat)

	rendererURL.RawQuery = queryParams.Encode()
	// gives service some additional time to timeout and return possible errors.

	reqContext, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	payload := map[string]string{
		"companyLogo": opts.CompanyLogo,
	}
	body, _ := json.Marshal(payload)

	resp, err := rs.doRequest(reqContext, rendererURL, opts.Headers, "POST", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	// save response to file
	defer func() {
		if err := resp.Body.Close(); err != nil {
			rs.log.Warn("Failed to close response body", "err", err)
		}
	}()

	// BMC - needs to be reviewed by Khalil
	err = rs.writeResponseToFile(reqContext, resp, filePath)
	if err != nil {
		return nil, err
	}
	//Conditional Broadcasting custom header for report generation
	fileStatusStr := resp.Header.Get("Generation-Status")
	fileStatus := fileStatusStr == "true"

	return &RenderResult{FilePath: filePath, GenerationReport: fileStatus}, nil
}
func (rs *RenderingService) customCSVViaHTTP(ctx context.Context, renderKey string, opts CustomCSVOpts) (*RenderResult, error) {
	filePath, err := rs.getNewFilePath(RenderCSV)
	if err != nil {
		return nil, err
	}

	rendererURL, err := url.Parse(rs.Cfg.RendererUrl + "/rs_csv")
	if err != nil {
		return nil, err
	}

	opts.Path = rs.getPanelURL(opts.OrgID, opts.UID, opts.PanelId, opts.From, opts.To, opts.Variables, opts.CSVDelimiter, opts.EnableOverrides, opts.HideHeader, opts.Enclosed, opts.Newline)
	opts.Path = opts.Path + "&showRepeat=true"

	queryParams := rendererURL.Query()
	queryParams.Add("renderKey", renderKey)
	queryParams.Add("domain", rs.domain)
	queryParams.Add("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	queryParams.Add("encoding", opts.Encoding)
	queryParams.Add("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))

	queryParams.Add("url", opts.Path)
	queryParams.Add("from", opts.From)
	queryParams.Add("to", opts.To)

	rendererURL.RawQuery = queryParams.Encode()

	// gives service some additional time to timeout and return possible errors.
	reqContext, cancel := context.WithTimeout(ctx, opts.Timeout+time.Second*2)
	defer cancel()

	resp, err := rs.doRequest(reqContext, rendererURL, opts.Headers, "GET", nil)
	if err != nil {
		return nil, err
	}

	// save response to file
	defer func() {
		if err := resp.Body.Close(); err != nil {
			rs.log.Warn("Failed to close response body", "err", err)
		}
	}()

	// BMC - needs to be reviewed by Khalil
	err = rs.writeResponseToFile(reqContext, resp, filePath)
	if err != nil {
		return nil, err
	}
	//Conditional Broadcasting custom header for report generation
	fileStatusStr := resp.Header.Get("Generation-Status")
	fileStatus := fileStatusStr == "true"

	return &RenderResult{FilePath: filePath, GenerationReport: fileStatus}, nil
}
func (rs *RenderingService) customXLSViaHTTP(ctx context.Context, renderKey string, opts CustomXLSOpts) (*RenderResult, error) {
	filePath, err := rs.getNewFilePath(RenderXLS)
	if err != nil {
		return nil, err
	}

	rendererURL, err := url.Parse(rs.Cfg.RendererUrl + "/rs_xls")
	if err != nil {
		return nil, err
	}

	opts.Path = rs.getSoloPanelURL(opts.OrgID, opts.UID, opts.PanelId, opts.From, opts.To, opts.Variables)
	opts.Path = opts.Path + "&showRepeat=true"

	queryParams := rendererURL.Query()
	queryParams.Add("renderKey", renderKey)
	queryParams.Add("domain", rs.domain)
	queryParams.Add("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	queryParams.Add("encoding", opts.Encoding)
	queryParams.Add("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))

	queryParams.Add("url", opts.Path)
	queryParams.Add("from", opts.From)
	queryParams.Add("to", opts.To)
	rendererURL.RawQuery = queryParams.Encode()

	// gives service some additional time to timeout and return possible errors.
	reqContext, cancel := context.WithTimeout(ctx, opts.Timeout+time.Second*2)
	defer cancel()

	resp, err := rs.doRequest(reqContext, rendererURL, opts.Headers, "GET", nil)
	if err != nil {
		return nil, err
	}

	// save response to file
	defer func() {
		if err := resp.Body.Close(); err != nil {
			rs.log.Warn("Failed to close response body", "err", err)
		}
	}()

	// BMC - needs to be reviewed by Khalil
	err = rs.writeResponseToFile(reqContext, resp, filePath)
	if err != nil {
		return nil, err
	}
	//Conditional Broadcasting custom header for report generation
	fileStatusStr := resp.Header.Get("Generation-Status")
	fileStatus := fileStatusStr == "true"

	return &RenderResult{FilePath: filePath, GenerationReport: fileStatus}, nil
}

func (rs *RenderingService) CustomRenderPDF(ctx context.Context, opts CustomPDFOpts, session Session) (*RenderResult, error) {
	startTime := time.Now()

	renderKeyProvider := rs.perRequestRenderKeyProvider
	if session != nil {
		renderKeyProvider = session
	}

	result, err := rs.customRenderPDF(ctx, opts, renderKeyProvider)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, RenderPDF)

	return result, err
}
func (rs *RenderingService) customRenderPDF(ctx context.Context, opts CustomPDFOpts, renderKeyProvider renderKeyProvider) (*RenderResult, error) {
	if int(atomic.LoadInt32(&rs.inProgressCount)) > opts.ConcurrentLimit {
		rs.log.Warn("Could not render pdf, hit the currency limit", "concurrencyLimit", opts.ConcurrentLimit, "path", opts.Path)
		filePath := "public/img/rendering_limit.png"
		return &RenderResult{
			FilePath: filepath.Join(rs.Cfg.HomePath, filePath),
		}, nil
	}

	if !rs.IsAvailable(ctx) {
		rs.log.Warn("Could not render pdf, no image renderer found/installed. " +
			"For pdf rendering support please install the renderer plugin. ")
		return rs.renderUnavailableImage(), nil
	}

	rs.log.Info("Rendering", "path", opts.Path, "orgId", opts.OrgID, "dashboard", opts.UID, "report", opts.ReportName)
	if math.IsInf(opts.DeviceScaleFactor, 0) || math.IsNaN(opts.DeviceScaleFactor) || opts.DeviceScaleFactor <= 0 {
		opts.DeviceScaleFactor = 1
	}
	renderKey, err := renderKeyProvider.get(ctx, opts.AuthOpts)
	if err != nil {
		return nil, err
	}

	defer renderKeyProvider.afterRequest(ctx, opts.AuthOpts, renderKey)

	defer func() {
		metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, -1)))
	}()

	metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, 1)))
	return rs.customPDFAction(ctx, renderKey, opts)
}

func (rs *RenderingService) CustomRenderCSV(ctx context.Context, opts CustomCSVOpts, session Session) (*RenderResult, error) {
	startTime := time.Now()

	renderKeyProvider := rs.perRequestRenderKeyProvider
	if session != nil {
		renderKeyProvider = session
	}

	result, err := rs.customRenderCSV(ctx, opts, renderKeyProvider)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, RenderCSV)

	return result, err
}
func (rs *RenderingService) customRenderCSV(ctx context.Context, opts CustomCSVOpts, renderKeyProvider renderKeyProvider) (*RenderResult, error) {
	if int(atomic.LoadInt32(&rs.inProgressCount)) > opts.ConcurrentLimit {
		rs.log.Warn("Could not render csv, hit the currency limit", "concurrencyLimit", opts.ConcurrentLimit, "path", opts.Path)

		filePath := "public/img/rendering_limit.png"
		return &RenderResult{
			FilePath: filepath.Join(rs.Cfg.HomePath, filePath),
		}, nil
	}

	if !rs.IsAvailable(ctx) {
		rs.log.Warn("Could not render csv, no image renderer found/installed. " +
			"For csv rendering support please install the renderer plugin. ")
		return rs.renderUnavailableImage(), nil
	}

	rs.log.Info("Rendering", "path", opts.Path, "orgId", opts.OrgID, "dashboard", opts.UID, "panelId", opts.PanelId)
	renderKey, err := renderKeyProvider.get(ctx, opts.AuthOpts)
	if err != nil {
		return nil, err
	}

	defer renderKeyProvider.afterRequest(ctx, opts.AuthOpts, renderKey)

	defer func() {
		metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, -1)))
	}()

	metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, 1)))
	return rs.customCSVAction(ctx, renderKey, opts)
}

func (rs *RenderingService) CustomRenderXLS(ctx context.Context, opts CustomXLSOpts, session Session) (*RenderResult, error) {
	startTime := time.Now()

	renderKeyProvider := rs.perRequestRenderKeyProvider
	if session != nil {
		renderKeyProvider = session
	}

	result, err := rs.customRenderXLS(ctx, opts, renderKeyProvider)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, RenderCSV)

	return result, err
}
func (rs *RenderingService) customRenderXLS(ctx context.Context, opts CustomXLSOpts, renderKeyProvider renderKeyProvider) (*RenderResult, error) {
	if int(atomic.LoadInt32(&rs.inProgressCount)) > opts.ConcurrentLimit {
		rs.log.Warn("Could not render csv, hit the currency limit", "concurrencyLimit", opts.ConcurrentLimit, "path", opts.Path)

		filePath := "public/img/rendering_limit.png"
		return &RenderResult{
			FilePath: filepath.Join(rs.Cfg.HomePath, filePath),
		}, nil
	}

	if !rs.IsAvailable(ctx) {
		rs.log.Warn("Could not render csv, no image renderer found/installed. " +
			"For csv rendering support please install the renderer plugin. ")
		return rs.renderUnavailableImage(), nil
	}

	rs.log.Info("Rendering", "path", opts.Path, "orgId", opts.OrgID, "dashboard", opts.UID, "panelId", opts.PanelId)
	renderKey, err := renderKeyProvider.get(ctx, opts.AuthOpts)
	if err != nil {
		return nil, err
	}

	defer renderKeyProvider.afterRequest(ctx, opts.AuthOpts, renderKey)

	defer func() {
		metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, -1)))
	}()

	metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, 1)))
	return rs.customXLSAction(ctx, renderKey, opts)
}

func (rs *RenderingService) getDashURL(uid string, orgId int64, from string, to string, variables string) string {
	values := url.Values{}

	values.Add("orgId", fmt.Sprintf("%v", orgId))
	values.Add("from", from)
	values.Add("to", to)

	t := rs.getDomain(orgId)
	if t != "" {
		values.Add("tenantDomain", t)
	}

	return fmt.Sprintf("%sd/%s/_?%s&%s", rs.Cfg.RendererCallbackUrl, uid, values.Encode(), variables)
}
func (rs *RenderingService) getPanelURL(orgId int64, uid, panelId, from, to, variables string, csvDelimiter string, enableOverrides string, hideHeader string, enclosed string, newline string) string {
	values := url.Values{}

	values.Add("orgId", fmt.Sprintf("%v", orgId))
	values.Add("from", from)
	values.Add("to", to)

	values.Add("inspectTab", "data")
	values.Add("inspect", panelId)

	values.Add("viewPanel", panelId)
	values.Add("csvDelimiter", csvDelimiter)
	values.Add("enableOverrides", enableOverrides)
	if hideHeader != "" {
		values.Add("hideHeader", hideHeader)
	}
	if enclosed != "" {
		values.Add("enclosed", enclosed)
	}
	if newline != "" {
		values.Add("newline", newline)
	}

	return fmt.Sprintf("%sd/%s/_?%s&%s", rs.Cfg.RendererCallbackUrl, uid, values.Encode(), variables)
}

func (rs *RenderingService) getSoloPanelURL(orgId int64, uid, panelId, from, to, variables string) string {
	values := url.Values{}

	values.Add("orgId", fmt.Sprintf("%v", orgId))
	values.Add("from", from)
	values.Add("to", to)

	values.Add("panelId", panelId)

	return fmt.Sprintf("%sd-solo/%s/_?%s&%s", rs.Cfg.RendererCallbackUrl, uid, values.Encode(), variables)
}

// DRJ71-13851 - vishaln
func (rs *RenderingService) getDomain(orgId int64) string {
	tenantDomain, err := reporting_scheduler.GetCachedTenantDomain(orgId)

	if err != nil {
		rs.log.Error("could not fetch tenant details from TMS API")
		return ""
	}
	return tenantDomain
}

// DRJ71-13851 end

// BMC Code: Start
// Repeated Panels usecase to get the repeated panel ids for a given dashboard
func (rs *RenderingService) CustomGetPanelId(ctx context.Context, opts CustomGetRepeatedPanelsOpts, session Session) (*RenderResult, error) {
	startTime := time.Now()

	renderKeyProvider := rs.perRequestRenderKeyProvider
	if session != nil {
		renderKeyProvider = session
	}

	result, err := rs.customGetPanelId(ctx, opts, renderKeyProvider)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, RenderPDF)

	return result, err
}
func (rs *RenderingService) customGetPanelId(ctx context.Context, opts CustomGetRepeatedPanelsOpts, renderKeyProvider renderKeyProvider) (*RenderResult, error) {
	if int(atomic.LoadInt32(&rs.inProgressCount)) > opts.ConcurrentLimit {
		rs.log.Warn("Could not render pdf, hit the currency limit", "concurrencyLimit", opts.ConcurrentLimit, "path", opts.Path)
		filePath := "public/img/rendering_limit.png"
		return &RenderResult{
			FilePath: filepath.Join(rs.Cfg.HomePath, filePath),
		}, nil
	}

	if !rs.IsAvailable(ctx) {
		rs.log.Warn("Could not render pdf, no image renderer found/installed. " +
			"For pdf rendering support please install the renderer plugin. ")
		return rs.renderUnavailableImage(), nil
	}

	rs.log.Info("Rendering", "path", opts.Path, "orgId", opts.OrgID, "dashboard", opts.UID)
	renderKey, err := renderKeyProvider.get(ctx, opts.AuthOpts)
	if err != nil {
		return nil, err
	}

	defer renderKeyProvider.afterRequest(ctx, opts.AuthOpts, renderKey)

	defer func() {
		metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, -1)))
	}()

	metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, 1)))
	return rs.customPanelIDAction(ctx, renderKey, opts)
}

func (rs *RenderingService) customPanelIDHTTP(ctx context.Context, renderKey string, opts CustomGetRepeatedPanelsOpts) (*RenderResult, error) {
	filePath, err := rs.getNewFilePath(RenderPDF)
	if err != nil {
		return nil, err
	}
	rendererURL, err := url.Parse(rs.Cfg.RendererUrl + "/panels")
	if err != nil {
		return nil, err
	}
	// Remove the global and add this to config file
	repeatPanelLimit := setting.RepeatVariablesLimit
	opts.Path = rs.getDashURL(opts.UID, opts.OrgID, opts.From, opts.To, opts.Variables)
	opts.Path = opts.Path + "&showRepeat=true"

	queryParams := rendererURL.Query()
	queryParams.Add("renderKey", renderKey)
	queryParams.Add("domain", rs.domain)
	queryParams.Add("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	queryParams.Add("encoding", opts.Encoding)
	queryParams.Add("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))

	queryParams.Add("url", opts.Path)
	queryParams.Add("from", opts.From)
	queryParams.Add("to", opts.To)
	queryParams.Add("showRepeat", opts.ShowRepeat)

	rendererURL.RawQuery = queryParams.Encode()
	// gives service some additional time to timeout and return possible errors.

	reqContext, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	resp, err := rs.doRequest(reqContext, rendererURL, opts.Headers, "GET", nil)
	if err != nil {
		return nil, err
	}

	// save response to file
	defer func() {
		if err := resp.Body.Close(); err != nil {
			rs.log.Warn("Failed to close response body", "err", err)
		}
	}()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("renderer returned error status: %d", resp.StatusCode)
	}

	var result struct {
		PanelIDs []struct {
			ID    interface{} `json:"id"`
			Type  string      `json:"type"`
			Title string      `json:"title"`
		} `json:"panelIds"`
	}
	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()
	if err := decoder.Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode renderer response: %w", err)
	}

	if len(result.PanelIDs) > repeatPanelLimit {
		rs.log.Warn("Number of repeated panels exceeds the configured limit", "limit", repeatPanelLimit, "found", len(result.PanelIDs))

		return &RenderResult{FilePath: filePath, StatusCodeCheck: 406}, nil
	}

	panelInfo := make([]PanelInfo, len(result.PanelIDs))
	for i, panel := range result.PanelIDs {
		id, err := parsePanelID(panel.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to parse panel id at index %d: %w", i, err)
		}

		panelInfo[i] = PanelInfo{
			ID:    id,
			Type:  panel.Type,
			Title: panel.Title,
		}
	}

	return &RenderResult{FilePath: filePath, RepeatedPanelIds: panelInfo}, nil
}

func parsePanelID(raw interface{}) (string, error) {
	switch v := raw.(type) {
	case string:
		return v, nil
	case json.Number:
		return v.String(), nil
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64), nil
	default:
		return "", fmt.Errorf("unsupported panel id type %T", raw)
	}
}

// BMC Code: End
