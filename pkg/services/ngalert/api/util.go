package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

var searchRegex = regexp.MustCompile(`\{(\w+)\}`)

var NotImplementedResp = ErrResp(http.StatusNotImplemented, errors.New("endpoint not implemented"), "")

func toMacaronPath(path string) string {
	return string(searchRegex.ReplaceAllFunc([]byte(path), func(s []byte) []byte {
		m := string(s[1 : len(s)-1])
		return []byte(fmt.Sprintf(":%s", m))
	}))
}

func getDatasourceByUID(ctx *models.ReqContext, cache datasources.CacheService, expectedType apimodels.Backend) (*datasources.DataSource, error) {
	datasourceUID := web.Params(ctx.Req)[":DatasourceUID"]
	ds, err := cache.GetDatasourceByUID(ctx.Req.Context(), datasourceUID, ctx.SignedInUser, ctx.SkipCache)
	if err != nil {
		return nil, err
	}
	switch expectedType {
	case apimodels.AlertmanagerBackend:
		if ds.Type != "alertmanager" {
			return nil, unexpectedDatasourceTypeError(ds.Type, "alertmanager")
		}
	case apimodels.LoTexRulerBackend:
		if ds.Type != "loki" && ds.Type != "prometheus" {
			return nil, unexpectedDatasourceTypeError(ds.Type, "loki, prometheus")
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
// 1. overwrites the underlying response writer used by a *models.ReqContext because AlertingProxy needs to intercept
// the response from the data source to analyze it and probably change
// 2. elevates the current user permissions to Editor if both conditions are met: RBAC is enabled, user does not have Editor role.
// This is needed to bypass the plugin authorization, which still relies on the legacy roles.
// This elevation can be considered safe because all upstream calls are protected by the RBAC on web request router level.
func (p *AlertingProxy) createProxyContext(ctx *models.ReqContext, request *http.Request, response *response.NormalResponse) *models.ReqContext {
	cpy := *ctx
	cpyMCtx := *cpy.Context
	cpyMCtx.Resp = web.NewResponseWriter(ctx.Req.Method, &safeMacaronWrapper{response})
	cpy.Context = &cpyMCtx
	cpy.Req = request

	// If RBAC is enabled, the actions are checked upstream and if the user gets here then it is allowed to do an action against a datasource.
	// Some data sources require legacy Editor role in order to perform mutating operations. In this case, we elevate permissions for the context that we
	// will provide downstream.
	// TODO (yuri) remove this after RBAC for plugins is implemented
	if !p.ac.IsDisabled() && !ctx.SignedInUser.HasRole(org.RoleEditor) {
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
	ctx *models.ReqContext,
	method string,
	u *url.URL,
	body io.Reader,
	extractor func(*response.NormalResponse) (interface{}, error),
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
			var m map[string]interface{}
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

func yamlExtractor(v interface{}) func(*response.NormalResponse) (interface{}, error) {
	return func(resp *response.NormalResponse) (interface{}, error) {
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

func jsonExtractor(v interface{}) func(*response.NormalResponse) (interface{}, error) {
	if v == nil {
		// json unmarshal expects a pointer
		v = &map[string]interface{}{}
	}
	return func(resp *response.NormalResponse) (interface{}, error) {
		contentType := resp.Header().Get("Content-Type")
		if !strings.Contains(contentType, "json") {
			return nil, fmt.Errorf("unexpected content type from upstream. expected JSON, got %v", contentType)
		}
		return v, json.Unmarshal(resp.Body(), v)
	}
}

func messageExtractor(resp *response.NormalResponse) (interface{}, error) {
	return map[string]string{"message": string(resp.Body())}, nil
}

func validateCondition(ctx context.Context, c ngmodels.Condition, user *user.SignedInUser, skipCache bool, datasourceCache datasources.CacheService) error {
	if len(c.Data) == 0 {
		return nil
	}

	refIDs, err := validateQueriesAndExpressions(ctx, c.Data, user, skipCache, datasourceCache)
	if err != nil {
		return err
	}

	t := make([]string, 0, len(refIDs))
	for refID := range refIDs {
		t = append(t, refID)
	}
	if _, ok := refIDs[c.Condition]; !ok {
		return fmt.Errorf("condition %s not found in any query or expression: it should be one of: [%s]", c.Condition, strings.Join(t, ","))
	}
	return nil
}

// conditionValidator returns a curried validateCondition that accepts only condition
func conditionValidator(c *models.ReqContext, cache datasources.CacheService) func(ngmodels.Condition) error {
	return func(condition ngmodels.Condition) error {
		return validateCondition(c.Req.Context(), condition, c.SignedInUser, c.SkipCache, cache)
	}
}

func validateQueriesAndExpressions(ctx context.Context, data []ngmodels.AlertQuery, user *user.SignedInUser, skipCache bool, datasourceCache datasources.CacheService) (map[string]struct{}, error) {
	refIDs := make(map[string]struct{})
	if len(data) == 0 {
		return nil, nil
	}

	for _, query := range data {
		datasourceUID, err := query.GetDatasource()
		if err != nil {
			return nil, err
		}

		isExpression, err := query.IsExpression()
		if err != nil {
			return nil, err
		}
		if isExpression {
			refIDs[query.RefID] = struct{}{}
			continue
		}

		_, err = datasourceCache.GetDatasourceByUID(ctx, datasourceUID, user, skipCache)
		if err != nil {
			return nil, fmt.Errorf("invalid query %s: %w: %s", query.RefID, err, datasourceUID)
		}
		refIDs[query.RefID] = struct{}{}
	}
	return refIDs, nil
}

// ErrorResp creates a response with a visible error
func ErrResp(status int, err error, msg string, args ...interface{}) *response.NormalResponse {
	if msg != "" {
		err = errors.WithMessagef(err, msg, args...)
	}
	return response.Error(status, err.Error(), err)
}

// accessForbiddenResp creates a response of forbidden access.
func accessForbiddenResp() response.Response {
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
