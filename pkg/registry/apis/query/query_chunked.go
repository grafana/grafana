package query

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/registry/rest"

	queryapi "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func (b *QueryAPIBuilder) queryChunkedDatasources(ctx context.Context, raw *queryapi.QueryDataRequest, w http.ResponseWriter, req *http.Request, responder rest.Responder, logger log.Logger) {
	ref, err := validateChunkedQuery(raw.QueryDataRequest)
	if err != nil {
		responder.Error(err)
		return
	}
	instance, err := b.instanceProvider.GetInstance(ctx, logger, ExtractKnownHeaders(req.Header))
	if err != nil {
		responder.Error(err)
		return
	}
	defer instance.ReportMetrics()
	features := instance.GetSettings().FeatureToggles
	if features == nil || !features.IsEnabled(ctx, featuremgmt.FlagDatasourcesChunkedQueryStreaming) {
		responder.Error(apierrors.NewBadRequest("chunked query streaming is not enabled"))
		return
	}
	// GetDataSourceClient retains the normal tenant routing and datasource authorization.
	client, err := instance.GetDataSourceClient(ctx, *ref)
	if err != nil {
		responder.Error(err)
		return
	}
	streaming, ok := client.(clientapi.ChunkedQueryDataClient)
	if !ok {
		responder.Error(apierrors.NewBadRequest("datasource client does not support chunked queries"))
		return
	}
	output := &queryChunkReceiver{w: w}
	err = streaming.QueryChunkedData(ctx, raw.QueryDataRequest, output)
	if err != nil {
		if !output.started {
			responder.Error(err)
			return
		}
		// Once frames have been sent, errors must use the same wire format.
		for _, q := range raw.Queries {
			if writeErr := output.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: q.RefID, Error: err.Error()}); writeErr != nil {
				break
			}
		}
		b.reportStatus(ctx, http.StatusBadGateway)
		return
	}
	if !output.started {
		w.Header().Set("Content-Type", chunked.CONTENT_TYPE)
	}
	b.reportStatus(ctx, http.StatusOK)
}

func validateChunkedQuery(raw v0alpha1.QueryDataRequest) (*v0alpha1.DataSourceRef, error) {
	if len(raw.Queries) == 0 {
		return nil, apierrors.NewBadRequest("at least one query is required")
	}
	refs := map[string]bool{}
	for _, q := range raw.Queries {
		if q.RefID == "" || refs[q.RefID] {
			return nil, apierrors.NewBadRequest("chunked queries require unique, nonempty refIds")
		}
		refs[q.RefID] = true
		if q.Datasource == nil || q.Datasource.UID == "" || q.Datasource.Type == "" {
			return nil, apierrors.NewBadRequest("chunked queries require datasource UID and type")
		}
		if q.Datasource.UID == "__expr__" || q.Datasource.Type == "__expr__" || q.Datasource.UID == "-100" {
			return nil, apierrors.NewBadRequest("chunked queries do not support expressions")
		}
	}
	_, ref, err := v0alpha1.ToDataSourceQueries(raw)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	return ref, nil
}

type queryChunkReceiver struct {
	w        http.ResponseWriter
	receiver chunked.RawChunkReceiver
	started  bool
}

func (r *queryChunkReceiver) OnChunk(c *pluginv2.QueryChunkedDataResponse) error {
	if r.receiver == nil {
		r.receiver = chunked.NewChunkedHTTPWriter(r.w)
	}
	r.started = true
	return r.receiver.OnChunk(c)
}
