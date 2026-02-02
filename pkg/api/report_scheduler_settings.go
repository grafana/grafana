package api

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	kp "github.com/grafana/grafana/pkg/bmc/kafkaproducer"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var logger = log.New("report_scheduler")

func (hs *HTTPServer) GetReportBrandingSettings(c *contextmodel.ReqContext) response.Response {
	result, err := hs.getReportSchedulerSettings(c)
	if err != nil {
		return hs.FailResponse(err)
	}
	return hs.SuccessResponse(result)
}

func (hs *HTTPServer) getReportSchedulerSettings(c *contextmodel.ReqContext) (dtos.RSSettings, error) {
	query := &models.GetReportBranding{
		OrgId: c.OrgID,
	}
	if err := hs.sqlStore.GetReportSettings(c.Req.Context(), query); err != nil {
		return dtos.RSSettings{InternalDomainsOnly: true}, err
	}
	opts := util.SanitizeOptions{
		AllowStyle: false,
	}
	query.Result.LogoUrl = util.SanitizeHtml(query.Result.LogoUrl, opts)
	query.Result.FooterText = util.SanitizeHtml(query.Result.FooterText, opts)
	query.Result.FooterTextUrl = util.SanitizeHtml(query.Result.FooterTextUrl, opts)
	domains := make([]string, 0)
	if query.Result.WhitelistedDomains != "" {
		domains = strings.Split(query.Result.WhitelistedDomains, ";")
	}
	return dtos.RSSettings{
		LogoUrl:             query.Result.LogoUrl,
		FooterText:          query.Result.FooterText,
		FooterTextUrl:       query.Result.FooterTextUrl,
		FooterSentBy:        query.Result.FooterSentBy,
		InternalDomainsOnly: query.Result.InternalDomainsOnly,
		WhitelistedDomains:  domains,
		DateFormat:          query.Result.DateFormat,
	}, nil
}

func (hs *HTTPServer) SetReportBrandingSettings(c *contextmodel.ReqContext) response.Response {
	preValue, err := hs.getReportSchedulerSettings(c)
	if err != nil {
		logger.Error("Failed to get previous report branding settings")
	}
	cmd := dtos.RSSettings{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while setting report branding settings", err)
	}
	isReportsLogoEnabeld := external.FeatureFlagReportsLogo.Enabled(c.Req, c.SignedInUser)

	if isReportsLogoEnabeld {
		if cmd.LogoUrl != "" && !util.IsValidURLOrBase64Image(cmd.LogoUrl) {
			err := "Invalid logo image. Only the following extensions are allowed: .png, .jpg, .jpeg"
			return response.Error(http.StatusBadRequest, err, nil)
		}
	} else {
		if cmd.LogoUrl != "" && !util.IsValidImageURL(cmd.LogoUrl) {
			err := "Invalid image URL. Only the following extensions are allowed: .png, .jpg, .jpeg"
			return response.Error(http.StatusBadRequest, err, nil)
		}

		if valid := util.ValidateUrlScheme(cmd.LogoUrl); cmd.LogoUrl != "" && !valid {
			return response.Error(http.StatusBadRequest, "Invalid logo URL", nil)
		}
	}

	if cmd.FooterTextUrl != "" && !util.ValidateUrlScheme(cmd.FooterTextUrl) {
		return response.Error(http.StatusBadRequest, "Invalid footer URL", nil)
	}
	opts := util.SanitizeOptions{
		AllowStyle: false,
	}
	cmd.LogoUrl = util.SanitizeHtml(cmd.LogoUrl, opts)
	cmd.FooterText = util.SanitizeHtml(cmd.FooterText, opts)
	cmd.FooterTextUrl = util.SanitizeHtml(cmd.FooterTextUrl, opts)
	// Verify and validate email domains
	var validDomains []string
	for _, domain := range cmd.WhitelistedDomains {
		if util.DomainValidator(domain) {
			validDomains = append(validDomains, domain)
		} else {
			logger.Warn("Email domain " + domain + " is invalid")
		}
	}
	query := &models.SetReportBranding{
		OrgId: c.OrgID,
		Data: models.ReportBranding{
			OrgID:               c.OrgID,
			LogoUrl:             cmd.LogoUrl,
			FooterText:          cmd.FooterText,
			FooterTextUrl:       cmd.FooterTextUrl,
			FooterSentBy:        cmd.FooterSentBy,
			InternalDomainsOnly: cmd.InternalDomainsOnly,
			WhitelistedDomains:  strings.Join(validDomains, ";"),
			StorageRetention:    cmd.StorageRetention,
			DateFormat:          cmd.DateFormat,
		},
	}
	if err := hs.sqlStore.SetReportSettings(c.Req.Context(), query); err != nil {
		kp.ReportBrandingSettingsEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to update branding setting with error: " + err.Error()})
		return hs.FailResponse(err)
	}

	newValue, err := hs.getReportSchedulerSettings(c)
	if err != nil {
		logger.Error("Failed to get updated report branding settings")
	}

	kp.ReportBrandingSettingsEvent.Send(kp.EventOpt{Ctx: c, Prev: preValue, New: newValue, OperationSubType: "Report branding is successfully updated"})

	return response.Success("Report branding is successfully updated.")
}
func (hs *HTTPServer) DeleteReportBrandingSettings(c *contextmodel.ReqContext) response.Response {
	query := &models.DeleteReportBranding{
		OrgId: c.OrgID,
	}

	if err := hs.sqlStore.DeleteReportSettings(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}
	return response.Success("Report branding is set to default.")
}

func (hs *HTTPServer) GetImageLogo(c *contextmodel.ReqContext) {
	result, err := hs.getReportSchedulerSettings(c)
	if err != nil {
		return
	}
	if result.LogoUrl == "" || strings.HasPrefix(result.LogoUrl, "data:image/") {
		return
	}

	if !util.IsValidURLOrBase64Image(result.LogoUrl) {
		return
	}

	parsedURL, err := url.Parse(result.LogoUrl)
	if err != nil {
		return
	}

	var reverseProxy = httputil.NewSingleHostReverseProxy(parsedURL)
	reverseProxy.Director = func(req *http.Request) {
		req.URL.Host = parsedURL.Host
		req.URL.Scheme = parsedURL.Scheme
		req.URL.Path = parsedURL.Path
		req.Header = make(http.Header)
		req.Header.Set("Content-Type", "image/png")
		req.Host = parsedURL.Host
	}
	reverseProxy.ServeHTTP(c.Resp, c.Req)
}
