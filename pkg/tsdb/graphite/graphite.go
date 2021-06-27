package graphite

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/opentracing/opentracing-go"
)

type GraphiteExecutor struct {
	httpClientProvider httpclient.Provider
}

// nolint:staticcheck // plugins.DataPlugin deprecated
func New(httpClientProvider httpclient.Provider) func(*models.DataSource) (plugins.DataPlugin, error) {
	// nolint:staticcheck // plugins.DataPlugin deprecated
	return func(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
		return &GraphiteExecutor{
			httpClientProvider: httpClientProvider,
		}, nil
	}
}

var glog = log.New("tsdb.graphite")

//nolint: staticcheck // plugins.DataQuery deprecated
func (e *GraphiteExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource, tsdbQuery plugins.DataQuery) (
	plugins.DataResponse, error) {
	// This logic is used when called from Dashboard Alerting.
	from := "-" + formatTimeRange(tsdbQuery.TimeRange.From)
	until := formatTimeRange(tsdbQuery.TimeRange.To)

	// This logic is used when called through server side expressions.
	if isTimeRangeNumeric(*tsdbQuery.TimeRange) {
		var err error
		from, until, err = epochMStoGraphiteTime(*tsdbQuery.TimeRange)
		if err != nil {
			return plugins.DataResponse{}, err
		}
	}

	var target string

	formData := url.Values{
		"from":          []string{from},
		"until":         []string{until},
		"format":        []string{"json"},
		"maxDataPoints": []string{"500"},
	}

	emptyQueries := make([]string, 0)
	for _, query := range tsdbQuery.Queries {
		glog.Debug("graphite", "query", query.Model)
		currTarget := ""
		if fullTarget, err := query.Model.Get("targetFull").String(); err == nil {
			currTarget = fullTarget
		} else {
			currTarget = query.Model.Get("target").MustString()
		}
		if currTarget == "" {
			glog.Debug("graphite", "empty query target", query.Model)
			emptyQueries = append(emptyQueries, fmt.Sprintf("Query: %v has no target", query.Model))
			continue
		}
		target = fixIntervalFormat(currTarget)
	}

	if target == "" {
		glog.Error("No targets in query model", "models without targets", strings.Join(emptyQueries, "\n"))
		return plugins.DataResponse{}, errors.New("no query target found for the alert rule")
	}

	formData["target"] = []string{target}

	if setting.Env == setting.Dev {
		glog.Debug("Graphite request", "params", formData)
	}

	req, err := e.createRequest(dsInfo, formData)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	httpClient, err := dsInfo.GetHTTPClient(e.httpClientProvider)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	span, ctx := opentracing.StartSpanFromContext(ctx, "graphite query")
	span.SetTag("target", target)
	span.SetTag("from", from)
	span.SetTag("until", until)
	span.SetTag("datasource_id", dsInfo.Id)
	span.SetTag("org_id", dsInfo.OrgId)

	defer span.Finish()

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header)); err != nil {
		return plugins.DataResponse{}, err
	}

	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	frames, err := e.toDataFrames(res)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	result := plugins.DataResponse{
		Results: make(map[string]plugins.DataQueryResult),
	}
	result.Results["A"] = plugins.DataQueryResult{
		RefID:      "A",
		Dataframes: plugins.NewDecodedDataFrames(frames),
	}
	return result, nil
}

func (e *GraphiteExecutor) parseResponse(res *http.Response) ([]TargetResponseDTO, error) {
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			glog.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		glog.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("request failed, status: %s", res.Status)
	}

	var data []TargetResponseDTO
	err = json.Unmarshal(body, &data)
	if err != nil {
		glog.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	return data, nil
}

func (e *GraphiteExecutor) toDataFrames(response *http.Response) (frames data.Frames, error error) {
	responseData, err := e.parseResponse(response)
	if err != nil {
		return nil, err
	}

	frames = data.Frames{}
	for _, series := range responseData {
		timeVector := make([]time.Time, 0, len(series.DataPoints))
		values := make([]*float64, 0, len(series.DataPoints))
		name := series.Target

		for _, dataPoint := range series.DataPoints {
			var timestamp, value, err = parseDataTimePoint(dataPoint)
			if err != nil {
				return nil, err
			}
			timeVector = append(timeVector, timestamp)
			values = append(values, value)
		}

		frames = append(frames, data.NewFrame(name,
			data.NewField("time", nil, timeVector),
			data.NewField("value", series.Tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name})))

		if setting.Env == setting.Dev {
			glog.Debug("Graphite response", "target", series.Target, "datapoints", len(series.DataPoints))
		}
	}
	return
}

func (e *GraphiteExecutor) createRequest(dsInfo *models.DataSource, data url.Values) (*http.Request, error) {
	u, err := url.Parse(dsInfo.Url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(data.Encode()))
	if err != nil {
		glog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.DecryptedBasicAuthPassword())
	}

	return req, err
}

func formatTimeRange(input string) string {
	if input == "now" {
		return input
	}
	return strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(input, "now", ""), "m", "min"), "M", "mon")
}

func fixIntervalFormat(target string) string {
	rMinute := regexp.MustCompile(`'(\d+)m'`)
	target = rMinute.ReplaceAllStringFunc(target, func(m string) string {
		return strings.ReplaceAll(m, "m", "min")
	})
	rMonth := regexp.MustCompile(`'(\d+)M'`)
	target = rMonth.ReplaceAllStringFunc(target, func(M string) string {
		return strings.ReplaceAll(M, "M", "mon")
	})
	return target
}

func isTimeRangeNumeric(tr plugins.DataTimeRange) bool {
	if _, err := strconv.ParseInt(tr.From, 10, 64); err != nil {
		return false
	}
	if _, err := strconv.ParseInt(tr.To, 10, 64); err != nil {
		return false
	}
	return true
}

func epochMStoGraphiteTime(tr plugins.DataTimeRange) (string, string, error) {
	from, err := strconv.ParseInt(tr.From, 10, 64)
	if err != nil {
		return "", "", err
	}

	to, err := strconv.ParseInt(tr.To, 10, 64)
	if err != nil {
		return "", "", err
	}

	return fmt.Sprintf("%d", from/1000), fmt.Sprintf("%d", to/1000), nil
}

/**
 * Graphite should always return timestamp as a number but values might be nil when data is missing
 */
func parseDataTimePoint(dataTimePoint plugins.DataTimePoint) (time.Time, *float64, error) {
	if !dataTimePoint[1].Valid {
		return time.Time{}, nil, errors.New("failed to parse data point timestamp")
	}

	timestamp := time.Unix(int64(dataTimePoint[1].Float64), 0).UTC()

	if dataTimePoint[0].Valid {
		var value = new(float64)
		*value = dataTimePoint[0].Float64
		return timestamp, value, nil
	} else {
		return timestamp, nil, nil
	}
}
