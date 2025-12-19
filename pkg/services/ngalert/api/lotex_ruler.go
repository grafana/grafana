package api

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/web"
)

const (
	Prometheus = "prometheus"
	Cortex     = "cortex"
	Mimir      = "mimir"
)

const (
	mimirPrefix      = "/config/v1/rules"
	prometheusPrefix = "/rules"
	lokiPrefix       = "/api/prom/rules"

	subtypeQuery = "subtype"
)

var subtypeToPrefix = map[string]string{
	Prometheus: prometheusPrefix,
	Cortex:     prometheusPrefix,
	Mimir:      mimirPrefix,
}

var (
	errManageAlertsDisabled = errutil.Forbidden(
		"alerting.manageAlertsDisabled",
		errutil.WithPublicMessage("Alert management is disabled for this datasource"),
	).Errorf("manage alerts is disabled")
)

// The requester is primarily used for testing purposes, allowing us to inject a different implementation of withReq.
type requester interface {
	withReq(ctx *contextmodel.ReqContext, method string, u *url.URL, body io.Reader, extractor func(*response.NormalResponse) (any, error), headers map[string]string) response.Response
}

type LotexRuler struct {
	log                        log.Logger
	features                   featuremgmt.FeatureToggles
	defaultManageAlertsEnabled bool
	*AlertingProxy
	requester requester
}

func NewLotexRuler(proxy *AlertingProxy, log log.Logger, features featuremgmt.FeatureToggles, defaultManageAlertsEnabled bool) *LotexRuler {
	return &LotexRuler{
		log:                        log,
		features:                   features,
		defaultManageAlertsEnabled: defaultManageAlertsEnabled,
		AlertingProxy:              proxy,
		requester:                  proxy,
	}
}

// handleValidateError returns appropriate error response: 403 for manageAlerts, 500 for others
func handleValidateError(err error) response.Response {
	if errors.Is(err, errManageAlertsDisabled) {
		return errorToResponse(err)
	}
	return ErrResp(500, err, "")
}

func (r *LotexRuler) RouteDeleteNamespaceRulesConfig(ctx *contextmodel.ReqContext, namespace string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return handleValidateError(err)
	}

	finalNamespace, err := getRulesNamespaceParam(ctx, namespace)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return r.requester.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf("%s/%s", legacyRulerPrefix, url.PathEscape(finalNamespace)),
		),
		nil,
		messageExtractor,
		nil,
	)
}

func (r *LotexRuler) RouteDeleteRuleGroupConfig(ctx *contextmodel.ReqContext, namespace string, group string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return handleValidateError(err)
	}

	finalNamespace, err := getRulesNamespaceParam(ctx, namespace)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	finalGroup, err := getRulesGroupParam(ctx, group)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return r.requester.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s/%s",
				legacyRulerPrefix,
				url.PathEscape(finalNamespace),
				url.PathEscape(finalGroup),
			),
		),
		nil,
		messageExtractor,
		nil,
	)
}

func (r *LotexRuler) RouteGetNamespaceRulesConfig(ctx *contextmodel.ReqContext, namespace string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return handleValidateError(err)
	}

	finalNamespace, err := getRulesNamespaceParam(ctx, namespace)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return r.requester.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s",
				legacyRulerPrefix,
				url.PathEscape(finalNamespace),
			),
		),
		nil,
		yamlExtractor(apimodels.NamespaceConfigResponse{}),
		nil,
	)
}

func (r *LotexRuler) RouteGetRulegGroupConfig(ctx *contextmodel.ReqContext, namespace string, group string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return handleValidateError(err)
	}

	finalNamespace, err := getRulesNamespaceParam(ctx, namespace)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	finalGroup, err := getRulesGroupParam(ctx, group)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return r.requester.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s/%s",
				legacyRulerPrefix,
				url.PathEscape(finalNamespace),
				url.PathEscape(finalGroup),
			),
		),
		nil,
		yamlExtractor(&apimodels.GettableRuleGroupConfig{}),
		nil,
	)
}

func (r *LotexRuler) RouteGetRulesConfig(ctx *contextmodel.ReqContext) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return handleValidateError(err)
	}

	return r.requester.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			legacyRulerPrefix,
		),
		nil,
		yamlExtractor(apimodels.NamespaceConfigResponse{}),
		nil,
	)
}

func (r *LotexRuler) RoutePostNameRulesConfig(ctx *contextmodel.ReqContext, conf apimodels.PostableRuleGroupConfig, ns string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return handleValidateError(err)
	}
	yml, err := yaml.Marshal(conf)
	if err != nil {
		return ErrResp(500, err, "Failed marshal rule group")
	}

	finalNamespace, err := getRulesNamespaceParam(ctx, ns)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	u := withPath(*ctx.Req.URL, fmt.Sprintf("%s/%s", legacyRulerPrefix, url.PathEscape(finalNamespace)))
	return r.requester.withReq(ctx, http.MethodPost, u, bytes.NewBuffer(yml), jsonExtractor(nil), nil)
}

func (r *LotexRuler) validateAndGetPrefix(ctx *contextmodel.ReqContext) (string, error) {
	datasourceUID := web.Params(ctx.Req)[":DatasourceUID"]
	if datasourceUID == "" {
		return "", fmt.Errorf("datasource UID is invalid")
	}

	ds, err := r.DataProxy.DataSourceCache.GetDatasourceByUID(ctx.Req.Context(), datasourceUID, ctx.SignedInUser, ctx.SkipDSCache)
	if err != nil {
		return "", err
	}

	// nolint:staticcheck // not yet migrated to OpenFeature
	if r.features.IsEnabledGlobally(featuremgmt.FlagAlertingDisableDSAPIWithManageAlerts) {
		// Check if manageAlerts is disabled for this datasource
		// Use server default if not explicitly set in datasource jsonData
		manageAlerts := r.defaultManageAlertsEnabled
		if ds.JsonData != nil {
			if manageAlertsVal, ok := ds.JsonData.CheckGet("manageAlerts"); ok {
				manageAlerts = manageAlertsVal.MustBool(r.defaultManageAlertsEnabled)
			}
		}
		if !manageAlerts {
			return "", errManageAlertsDisabled
		}
	}

	// Validate URL
	if ds.URL == "" {
		return "", fmt.Errorf("URL for this data source is empty")
	}

	var prefix string
	switch {
	case isPrometheusCompatible(ds.Type):
		prefix = prometheusPrefix
	case ds.Type == datasources.DS_LOKI:
		prefix = lokiPrefix
	default:
		return "", unexpectedDatasourceTypeError(ds.Type, "loki, prometheus, amazon prometheus, azure prometheus")
	}

	// If the datasource is Loki, there's nothing else for us to do - it doesn't have subtypes.
	if ds.Type == datasources.DS_LOKI {
		return prefix, nil
	}

	// A Prometheus datasource, can have many subtypes: Cortex, Mimir and vanilla Prometheus.
	// Based on these subtypes, we want to use a different proxying path.
	subtype := ctx.Query(subtypeQuery)
	subTypePrefix, ok := subtypeToPrefix[subtype]
	if !ok {
		r.log.Debug(
			"Unable to determine prometheus datasource subtype, using default prefix",
			"datasource", ds.UID, "datasourceType", ds.Type, "subtype", subtype, "prefix", prefix)
		return prefix, nil
	}

	r.log.Debug("Determined prometheus datasource subtype",
		"datasource", ds.UID, "datasourceType", ds.Type, "subtype", subtype)
	return subTypePrefix, nil
}

func withPath(u url.URL, newPath string) *url.URL {
	u.Path, _ = url.PathUnescape(newPath)
	u.RawPath = newPath

	return &u
}
