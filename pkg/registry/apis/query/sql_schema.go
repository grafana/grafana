package query

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	query "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	service "github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

// called by mt query service and also when queryServiceFromUI is enabled, can be both mt and st
func (b *QueryAPIBuilder) GetSQLSchemas(w http.ResponseWriter, r *http.Request) {
	ctx, span := b.tracer.Start(r.Context(), "QueryService.GetSQLSchemas")
	defer span.End()

	ns := mux.Vars(r)["namespace"]

	ctx = request.WithNamespace(ctx, ns)
	traceId := span.SpanContext().TraceID()
	connectLogger := b.log.New("traceId", traceId.String(), "rule_uid", r.Header.Get("X-Rule-Uid"))

	raw := &query.QueryDataRequest{}
	err := web.Bind(r, raw)
	if err != nil {
		connectLogger.Error("Hit unexpected error when reading query", "err", err)
		err = errorsK8s.NewBadRequest("error reading query")
		errhttp.Write(ctx, err, w)
		return
	}

	qdr, err := handleSQLSchemaQuery(ctx, *raw, *b, r, connectLogger)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	// Write the response
	w.Header().Set("Content-Type", "application/json")
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ") // pretty print
	err = encoder.Encode(&query.QueryResponseSQLSchemas{
		TypeMeta: v1.TypeMeta{
			APIVersion: query.SchemeGroupVersion.String(),
			Kind:       "QueryResponseSQLSchemas",
		},
		SQLSchemas: qdr,
	})
	if err != nil {
		errhttp.Write(ctx, err, w)
	}
}

func handlePreparedSQLSchema(ctx context.Context, pq *preparedQuery) (query.SQLSchemas, error) {
	resp, err := service.GetSQLSchemas(ctx, pq.logger, pq.cache, pq.exprSvc, pq.mReq, pq.builder, pq.headers)
	pq.reportMetrics()
	return resp, err
}

func handleSQLSchemaQuery(
	ctx context.Context,
	raw query.QueryDataRequest,
	b QueryAPIBuilder,
	httpreq *http.Request,
	connectLogger log.Logger,
) (query.SQLSchemas, error) {
	pq, err := prepareQuery(ctx, raw, b, httpreq, connectLogger)
	if err != nil {
		return nil, err
	}
	return handlePreparedSQLSchema(ctx, pq)
}
