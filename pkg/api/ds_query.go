package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/errhttp"
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
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagQueryServiceRewrite) {
		// rewrite requests from /ds/query to the new query service
		namespaceMapper := request.GetNamespaceMapper(hs.Cfg)
		return func(w http.ResponseWriter, r *http.Request) {
			user, err := identity.GetRequester(r.Context())
			if err != nil || user == nil {
				errhttp.Write(r.Context(), fmt.Errorf("no user"), w)
				return
			}
			r.URL.Path = "/apis/query.grafana.app/v0alpha1/namespaces/" + namespaceMapper(user.GetOrgID()) + "/query"
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

	resp, err := hs.queryDataService.QueryData(c.Req.Context(), c.SignedInUser, c.SkipDSCache, reqDTO)
	if err != nil {
		return hs.handleQueryMetricsError(err)
	}
	// bmc code change
	return hs.toJsonStreamingResponse(c.Req.Context(), c, reqDTO, resp)
}

func (hs *HTTPServer) toJsonStreamingResponse(ctx context.Context, c *contextmodel.ReqContext, reqDTO dtos.MetricRequest, qdr *backend.QueryDataResponse) response.Response {
	statusCode := http.StatusOK
	for _, res := range qdr.Responses {
		if res.Error != nil {
			statusCode = http.StatusBadRequest
			break
		}
	}

	if statusCode == http.StatusBadRequest {
		// an error in the response we treat as downstream.
		requestmeta.WithDownstreamStatusSource(ctx)
	}

	// BMC code starts
	// This counts bytes as they're streamed
	cw := &countingWriter{ResponseWriter: c.Resp}

	// Create a custom response that uses the counting writer
	countingResp := &countingStreamingResponse{
		StreamingResponse: response.JSONStreaming(statusCode, qdr),
		countingWriter:    cw,
		onComplete: func(size int64) {
			hs.addQueryResponseMetrics(ctx, c, reqDTO, size)
		},
	}

	return countingResp
	//bmc code ends
}

// bmc code starts
// countingWriter wraps a web.ResponseWriter to count bytes written
type countingWriter struct {
	web.ResponseWriter
	count int64
}

func (cw *countingWriter) Write(p []byte) (int, error) {
	n, err := cw.ResponseWriter.Write(p)
	cw.count += int64(n)
	return n, err
}

// countingStreamingResponse wraps StreamingResponse to count bytes during streaming
type countingStreamingResponse struct {
	response.StreamingResponse
	countingWriter *countingWriter
	onComplete     func(int64)
}

func (r *countingStreamingResponse) WriteTo(ctx *contextmodel.ReqContext) {
	// Temporarily replace ctx.Resp with our counting writer
	originalResp := ctx.Resp
	ctx.Resp = r.countingWriter

	// Ensure we restore the original writer even if WriteTo panics
	defer func() {
		ctx.Resp = originalResp
		// Call the completion callback with the count (even if there was an error/panic)
		if r.onComplete != nil {
			r.onComplete(r.countingWriter.count)
		}
	}()

	// Write the response (this will count bytes as they're streamed)
	r.StreamingResponse.WriteTo(ctx)
}

// addQueryResponseMetrics adds metrics for query response data size
func (hs *HTTPServer) addQueryResponseMetrics(ctx context.Context, c *contextmodel.ReqContext, reqDTO dtos.MetricRequest, dataSize int64) {
	// Get datasource IDs from the request queries
	dsID := hs.getDatasourceIDsFromRequest(ctx, c, reqDTO)

	// Track metrics for each datasource
	orgIDStr := strconv.FormatInt(c.OrgID, 10)

	dsIDStr := strconv.FormatInt(dsID, 10)
	userIDStr := strconv.FormatInt(c.UserID, 10)

	dashboardID := c.Req.Header.Get("X-Dashboard-Uid")
	if dashboardID == "" {
		dashboardID = "0"
	}

	metric := metrics.MDataSourceProxyResDataSize.WithLabelValues(orgIDStr, dsIDStr, userIDStr, dashboardID)
	metric.Add(float64(dataSize))
}

// getDatasourceIDsFromRequest extracts datasource IDs from the MetricRequest queries
func (hs *HTTPServer) getDatasourceIDsFromRequest(ctx context.Context, c *contextmodel.ReqContext, reqDTO dtos.MetricRequest) int64 {
	if len(reqDTO.Queries) == 0 {
		return 0
	}

	query := reqDTO.Queries[0]
	if query == nil {
		return 0
	}

	return query.Get("datasourceId").MustInt64(0)
}

//bmc code end

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
