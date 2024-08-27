package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/models" // LOGZ.IO GRAFANA CHANGE :: DEV-43889 - Add headers for logzio datasources support
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/errutil/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) handleQueryMetricsError(err error) *response.NormalResponse {
	if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
		return response.Error(http.StatusForbidden, "Access denied to data source", err)
	}
	if errors.Is(err, datasources.ErrDataSourceNotFound) {
		return response.Error(http.StatusNotFound, "Data source not found", err)
	}

	var secretsPlugin datasources.ErrDatasourceSecretsPluginUserFriendly
	if errors.As(err, &secretsPlugin) {
		return response.Error(http.StatusInternalServerError, fmt.Sprint("Secrets Plugin error: ", err.Error()), err)
	}

	return response.ErrOrFallback(http.StatusInternalServerError, "Query data error", err)
}

// metrics.go
func (hs *HTTPServer) getDSQueryEndpoint() web.Handler {
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagKubernetesQueryServiceRewrite) {
		// DEV ONLY FEATURE FLAG!
		// rewrite requests from /ds/query to the new query service
		namespaceMapper := request.GetNamespaceMapper(hs.Cfg)
		return func(w http.ResponseWriter, r *http.Request) {
			user, err := appcontext.User(r.Context())
			if err != nil || user == nil {
				errhttp.Write(r.Context(), fmt.Errorf("no user"), w)
				return
			}
			r.URL.Path = "/apis/query.grafana.app/v0alpha1/namespaces/" + namespaceMapper(user.OrgID) + "/query"
			hs.clientConfigProvider.DirectlyServeHTTP(w, r)
		}
	}

	return routing.Wrap(hs.QueryMetricsV2)
}

// QueryMetricsV2 returns query metrics.
// swagger:route POST /ds/query ds queryMetricsWithExpressions
//
// DataSource query metrics with expressions.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:query`.
//
// Responses:
// 200: queryMetricsWithExpressionsRespons
// 207: queryMetricsWithExpressionsRespons
// 401: unauthorisedError
// 400: badRequestError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) QueryMetricsV2(c *contextmodel.ReqContext) response.Response {
	reqDTO := dtos.MetricRequest{}
	if err := web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	// LOGZ.IO GRAFANA CHANGE :: DEV-43889 - Add headers for logzio datasources support
	ctxWithLogzHeaders := models.WithLogzHeaders(c.Req.Context(), c.Req.Header)
	resp, err := hs.queryDataService.QueryData(ctxWithLogzHeaders, c.SignedInUser, c.SkipDSCache, reqDTO)
	// LOGZ.IO GRAFANA CHANGE :: End
	if err != nil {
		return hs.handleQueryMetricsError(err)
	}
	return hs.toJsonStreamingResponse(c.Req.Context(), resp)
}

func (hs *HTTPServer) toJsonStreamingResponse(ctx context.Context, qdr *backend.QueryDataResponse) response.Response {
	statusWhenError := http.StatusBadRequest
	if hs.Features.IsEnabled(ctx, featuremgmt.FlagDatasourceQueryMultiStatus) {
		statusWhenError = http.StatusMultiStatus
	}

	statusCode := http.StatusOK
	for _, res := range qdr.Responses {
		if res.Error != nil {
			statusCode = statusWhenError
		}
	}

	if statusCode == statusWhenError {
		// an error in the response we treat as downstream.
		requestmeta.WithDownstreamStatusSource(ctx)
	}

	return response.JSONStreaming(statusCode, qdr)
}

// swagger:parameters queryMetricsWithExpressions
type QueryMetricsWithExpressionsBodyParams struct {
	// in:body
	// required:true
	Body dtos.MetricRequest `json:"body"`
}

// swagger:response queryMetricsWithExpressionsRespons
type QueryMetricsWithExpressionsRespons struct {
	// The response message
	// in: body
	Body *backend.QueryDataResponse `json:"body"`
}
