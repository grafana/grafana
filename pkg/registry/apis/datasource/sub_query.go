package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	jsoniter "github.com/json-iterator/go"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	dataWrap "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
)

type subQueryREST struct {
	builder *DataSourceAPIBuilder
}

var (
	_ rest.Storage         = (*subQueryREST)(nil)
	_ rest.Connecter       = (*subQueryREST)(nil)
	_ rest.StorageMetadata = (*subQueryREST)(nil)
	_ rest.Scoper          = (*subQueryREST)(nil)
)

func (r *subQueryREST) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() says :)
	return &dsV0.QueryDataResponse{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) NamespaceScoped() bool {
	return true
}

func (r *subQueryREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *subQueryREST) ProducesObject(verb string) interface{} {
	return &dsV0.QueryDataResponse{}
}

func (r *subQueryREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *subQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	pluginCtx, err := r.builder.getPluginContext(ctx, name)

	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return nil, r.builder.datasourceResourceInfo.NewNotFound(name)
		}
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		dqr := dataWrap.QueryDataRequest{}
		err := web.Bind(req, &dqr)
		if err != nil {
			responder.Error(err)
			return
		}

		queries, dsRef, err := dataWrap.ToDataSourceQueries(dqr)
		if err != nil {
			responder.Error(err)
			return
		}
		if dsRef != nil && dsRef.UID != name {
			responder.Error(fmt.Errorf("expected query body datasource and request to match"))
			return
		}

		ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
		ctx = contextualMiddlewares(ctx)

		// Requesting chunked query response
		if isRequestingChunkedResponse(req.Header.Get("accept")) {
			if err = r.builder.client.QueryChunkedData(ctx, &backend.QueryChunkedDataRequest{
				Queries:       queries,
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
				Format:        backend.DataFrameFormat_JSON, // encode directly in the plugin
			}, newChunkWriter(w)); err != nil {
				responder.Error(fmt.Errorf("error running chunked query %w", err))
			}
			return
		}

		rsp, err := r.builder.client.QueryData(ctx, &backend.QueryDataRequest{
			Queries:       queries,
			PluginContext: pluginCtx,
			Headers:       map[string]string{},
		})

		// all errors get converted into k8 errors when sent in responder.Error and lose important context like downstream info
		var e errutil.Error
		if errors.As(err, &e) && e.Source == errutil.SourceDownstream {
			responder.Object(int(backend.StatusBadRequest),
				&dsV0.QueryDataResponse{QueryDataResponse: backend.QueryDataResponse{Responses: map[string]backend.DataResponse{
					"A": {
						Error:       errors.New(e.LogMessage),
						ErrorSource: backend.ErrorSourceDownstream,
						Status:      backend.StatusBadRequest,
					},
				}}},
			)
			return
		}

		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(dsV0.GetResponseCode(rsp),
			&dsV0.QueryDataResponse{QueryDataResponse: *rsp},
		)
	}), nil
}

func isRequestingChunkedResponse(accept string) bool {
	return accept == "text/event-stream"
}

var (
	_ backendplugin.RawChunkReceiver = (*rawChunkWriter)(nil)
)

type rawChunkWriter struct {
	stream *jsoniter.Stream
}

func newChunkWriter(w http.ResponseWriter) backendplugin.RawChunkReceiver {
	return &rawChunkWriter{
		stream: jsoniter.NewStream(jsoniter.ConfigCompatibleWithStandardLibrary, w, 1024*10),
	}
}

// ReceivedChunk implements [backendplugin.RawChunkReceiver].
func (r *rawChunkWriter) ReceivedChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	if chunk.Format != pluginv2.DataFrameFormat_JSON {
		return fmt.Errorf("expected json format")
	}

	r.stream.WriteRaw("data: ")
	r.stream.WriteObjectStart()
	r.stream.WriteObjectField("refId")
	r.stream.WriteString(chunk.RefId)

	if chunk.FrameId != "" {
		r.stream.WriteMore()
		r.stream.WriteObjectField("frameId")
		r.stream.WriteString(chunk.FrameId)
	}

	if chunk.Frame != nil {
		r.stream.WriteMore()
		r.stream.WriteObjectField("frame")
		r.stream.WriteRaw(string(chunk.Frame)) // must not contain newlines!
	}

	if chunk.Error != "" {
		r.stream.WriteMore()
		r.stream.WriteObjectField("error")
		r.stream.WriteString(chunk.Error)

		if chunk.ErrorSource != "" {
			r.stream.WriteMore()
			r.stream.WriteObjectField("errorSource")
			r.stream.WriteString(chunk.ErrorSource)
		}
	}

	r.stream.WriteObjectEnd()
	r.stream.WriteRaw("\n\n") // marks the end of a message in SSE
	return r.stream.Flush()
}

// WriteError implements [backend.ChunkedDataWriter].
func (r *rawChunkWriter) WriteError(ctx context.Context, refID string, status backend.Status, err error) error {
	return fmt.Errorf("unexpected callback (WriteError)")
}

// WriteFrame implements [backend.ChunkedDataWriter].
func (r *rawChunkWriter) WriteFrame(ctx context.Context, refID string, frameID string, f *data.Frame) error {
	return fmt.Errorf("unexpected callback (WriteFrame)")
}
