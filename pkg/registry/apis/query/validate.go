package query

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	queryV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	service "github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

// GetValidation handles POST requests to validate an expression pipeline without executing it.
func (b *QueryAPIBuilder) GetValidation(w http.ResponseWriter, r *http.Request) {
	ctx, span := b.tracer.Start(r.Context(), "QueryService.ValidatePipeline")
	defer span.End()

	ns := mux.Vars(r)["namespace"]

	ctx = request.WithNamespace(ctx, ns)
	traceId := span.SpanContext().TraceID()
	connectLogger := b.log.New("traceId", traceId.String())

	raw := &queryV0.QueryDataRequest{}
	err := web.Bind(r, raw)
	if err != nil {
		connectLogger.Error("Hit unexpected error when reading query", "err", err)
		err = errorsK8s.NewBadRequest("error reading query")
		errhttp.Write(ctx, err, w)
		return
	}

	validation, err := handleValidation(ctx, *raw, *b, r, connectLogger)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	// Write the response
	w.Header().Set("Content-Type", "application/json")
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ") // pretty print
	err = encoder.Encode(&queryV0.QueryResponseValidation{
		TypeMeta: v1.TypeMeta{
			APIVersion: queryV0.SchemeGroupVersion.String(),
			Kind:       "QueryResponseValidation",
		},
		PipelineValidation: *validation,
	})
	if err != nil {
		errhttp.Write(ctx, err, w)
	}
}

func handlePreparedValidation(ctx context.Context, pq *preparedQuery) (*queryV0.PipelineValidation, error) {
	resp, err := service.ValidatePipeline(ctx, pq.logger, pq.cache, pq.exprSvc, pq.mReq, pq.builder, pq.headers)
	pq.reportMetrics()
	return resp, err
}

func handleValidation(
	ctx context.Context,
	raw queryV0.QueryDataRequest,
	b QueryAPIBuilder,
	httpreq *http.Request,
	connectLogger log.Logger,
) (*queryV0.PipelineValidation, error) {
	pq, err := prepareQuery(ctx, raw, b, httpreq, connectLogger)
	if err != nil {
		return nil, err
	}
	return handlePreparedValidation(ctx, pq)
}
