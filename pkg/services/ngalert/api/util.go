package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

const (
	namespaceQueryTag = "QUERY_NAMESPACE"
	groupQueryTag     = "QUERY_GROUP"
)

var (
	searchRegex = regexp.MustCompile(`\{(\w+)\}`)

	prometheusCompatibleDsTypes = []string{
		datasources.DS_PROMETHEUS,
		datasources.DS_AMAZON_PROMETHEUS,
		datasources.DS_AZURE_PROMETHEUS,
	}
)

func isPrometheusCompatible(dsType string) bool {
	for _, t := range prometheusCompatibleDsTypes {
		if dsType == t {
			return true
		}
	}
	return false
}

func isLotexRulerCompatible(dsType string) bool {
	return dsType == datasources.DS_LOKI || isPrometheusCompatible(dsType)
}

func toMacaronPath(path string) string {
	return string(searchRegex.ReplaceAllFunc([]byte(path), func(s []byte) []byte {
		m := string(s[1 : len(s)-1])
		return []byte(fmt.Sprintf(":%s", m))
	}))
}

func getDatasourceByUID(ctx *contextmodel.ReqContext, cache datasources.CacheService, expectedType apimodels.Backend) (*datasources.DataSource, error) {
	datasourceUID := web.Params(ctx.Req)[":DatasourceUID"]
	ds, err := cache.GetDatasourceByUID(ctx.Req.Context(), datasourceUID, ctx.SignedInUser, ctx.SkipDSCache)
	if err != nil {
		return nil, err
	}
	switch expectedType {
	case apimodels.AlertmanagerBackend:
		if ds.Type != "alertmanager" {
			return nil, unexpectedDatasourceTypeError(ds.Type, "alertmanager")
		}
	case apimodels.LoTexRulerBackend:
		if !isLotexRulerCompatible(ds.Type) {
			return nil, unexpectedDatasourceTypeError(ds.Type, "loki, prometheus, amazon prometheus, azure prometheus")
		}
	default:
		return nil, unexpectedDatasourceTypeError(ds.Type, expectedType.String())
	}
	return ds, nil
}

// macaron unsafely asserts the http.ResponseWriter is an http.CloseNotifier, which will panic.
// Here we impl it, which will ensure this no longer happens, but neither will we take
// advantage cancelling upstream requests when the downstream has closed.
// NB: http.CloseNotifier is a deprecated ifc from before the context pkg.
type safeMacaronWrapper struct {
	http.ResponseWriter
}

func (w *safeMacaronWrapper) CloseNotify() <-chan bool {
	return make(chan bool)
}

// createProxyContext creates a new request context that is provided down to the data source proxy.
// The request context
// 1. overwrites the underlying response writer used by a *contextmodel.ReqContext because AlertingProxy needs to intercept
// the response from the data source to analyze it and probably change
// 2. elevates the current user permissions to Editor if both conditions are met: RBAC is enabled, user does not have Editor role.
// This is needed to bypass the plugin authorization, which still relies on the legacy roles.
// This elevation can be considered safe because all upstream calls are protected by the RBAC on web request router level.
func (p *AlertingProxy) createProxyContext(ctx *contextmodel.ReqContext, request *http.Request, response *response.NormalResponse) *contextmodel.ReqContext {
	cpy := *ctx
	cpyMCtx := *cpy.Context
	cpyMCtx.Resp = web.NewResponseWriter(ctx.Req.Method, &safeMacaronWrapper{response})
	cpy.Context = &cpyMCtx
	cpy.Req = request

	// If RBAC is enabled, the actions are checked upstream and if the user gets here then it is allowed to do an action against a datasource.
	// Some data sources require legacy Editor role in order to perform mutating operations. In this case, we elevate permissions for the context that we
	// will provide downstream.
	// TODO (yuri) remove this after RBAC for plugins is implemented
	if !ctx.HasRole(org.RoleEditor) {
		newUser := *ctx.SignedInUser
		newUser.OrgRole = org.RoleEditor
		cpy.SignedInUser = &newUser
	}
	return &cpy
}

type AlertingProxy struct {
	DataProxy *datasourceproxy.DataSourceProxyService
	ac        accesscontrol.AccessControl
}

// withReq proxies a different request
func (p *AlertingProxy) withReq(
	ctx *contextmodel.ReqContext,
	method string,
	u *url.URL,
	body io.Reader,
	extractor func(*response.NormalResponse) (any, error),
	headers map[string]string,
) response.Response {
	req, err := http.NewRequest(method, u.String(), body)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	for h, v := range headers {
		req.Header.Add(h, v)
	}
	// this response will be populated by the response from the datasource
	resp := response.CreateNormalResponse(make(http.Header), nil, 0)
	proxyContext := p.createProxyContext(ctx, req, resp)

	datasourceID := web.Params(ctx.Req)[":DatasourceID"]
	if datasourceID != "" {
		recipient, err := strconv.ParseInt(web.Params(ctx.Req)[":DatasourceID"], 10, 64)
		if err != nil {
			return ErrResp(http.StatusBadRequest, err, "DatasourceID is invalid")
		}
		p.DataProxy.ProxyDatasourceRequestWithID(proxyContext, recipient)
	} else {
		datasourceUID := web.Params(ctx.Req)[":DatasourceUID"]
		if datasourceUID == "" {
			return ErrResp(http.StatusBadRequest, err, "DatasourceUID is empty")
		}
		p.DataProxy.ProxyDatasourceRequestWithUID(proxyContext, datasourceUID)
	}

	status := resp.Status()
	if status >= 400 {
		errMessage := string(resp.Body())
		// if Content-Type is application/json
		// and it is successfully decoded and contains a message
		// return this as response error message
		if strings.HasPrefix(resp.Header().Get("Content-Type"), "application/json") {
			var m map[string]any
			if err := json.Unmarshal(resp.Body(), &m); err == nil {
				if message, ok := m["message"]; ok {
					errMessageStr, isString := message.(string)
					if isString {
						errMessage = errMessageStr
					}
				}
			}
		} else if strings.HasPrefix(resp.Header().Get("Content-Type"), "text/html") {
			// if Content-Type is text/html
			// do not return the body
			errMessage = "redacted html"
		}
		return ErrResp(status, errors.New(errMessage), "")
	}

	t, err := extractor(resp)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	b, err := json.Marshal(t)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(status, b)
}

func yamlExtractor(v any) func(*response.NormalResponse) (any, error) {
	return func(resp *response.NormalResponse) (any, error) {
		contentType := resp.Header().Get("Content-Type")
		if !strings.Contains(contentType, "yaml") {
			return nil, fmt.Errorf("unexpected content type from upstream. expected YAML, got %v", contentType)
		}
		decoder := yaml.NewDecoder(bytes.NewReader(resp.Body()))
		decoder.KnownFields(true)

		err := decoder.Decode(v)

		return v, err
	}
}

func jsonExtractor(v any) func(*response.NormalResponse) (any, error) {
	if v == nil {
		// json unmarshal expects a pointer
		v = &map[string]any{}
	}
	return func(resp *response.NormalResponse) (any, error) {
		contentType := resp.Header().Get("Content-Type")
		if !strings.Contains(contentType, "json") {
			return nil, fmt.Errorf("unexpected content type from upstream. expected JSON, got %v", contentType)
		}
		return v, json.Unmarshal(resp.Body(), v)
	}
}

func messageExtractor(resp *response.NormalResponse) (any, error) {
	return map[string]string{"message": string(resp.Body())}, nil
}

// ErrorResp creates a response with a visible error
func ErrResp(status int, err error, msg string, args ...any) *response.NormalResponse {
	if msg != "" {
		msg += ": %w"
		args = append(args, err)
		err = fmt.Errorf(msg, args...)
	}
	return response.Error(status, err.Error(), err)
}

// accessForbiddenResp creates a response of forbidden access.
func accessForbiddenResp() response.Response {
	//nolint:staticcheck // Grandfathered capitalization of error.
	return ErrResp(http.StatusForbidden, errors.New("Permission denied"), "")
}

func containsProvisionedAlerts(provenances map[string]ngmodels.Provenance, rules []*ngmodels.AlertRule) bool {
	if len(provenances) == 0 {
		return false
	}
	for _, rule := range rules {
		provenance, ok := provenances[rule.UID]
		if ok && provenance != ngmodels.ProvenanceNone {
			return true
		}
	}
	return false
}

func getHash(hashSlice []string) uint64 {
	sum := fnv.New64()
	for _, str := range hashSlice {
		_, _ = sum.Write([]byte(str))
	}
	hash := sum.Sum64()
	return hash
}

func getRulesGroupParam(ctx *contextmodel.ReqContext, pathGroup string) (string, error) {
	if pathGroup == groupQueryTag {
		group := ctx.Query("group")
		if group == "" {
			return "", fmt.Errorf("group query parameter is empty")
		}

		return group, nil
	}

	return pathGroup, nil
}

func getRulesNamespaceParam(ctx *contextmodel.ReqContext, pathNamespace string) (string, error) {
	if pathNamespace == namespaceQueryTag {
		namespace := ctx.Query("namespace")
		if namespace == "" {
			return "", fmt.Errorf("namespace query parameter is empty")
		}

		return namespace, nil
	}

	return pathNamespace, nil
}
