package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	jsoniter "github.com/json-iterator/go"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	dataWrap "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
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
	// This is added as the "ResponseType" regarless what ProducesObject() says :)
	return &query.QueryDataResponse{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) NamespaceScoped() bool {
	return true
}

func (r *subQueryREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *subQueryREST) ProducesObject(verb string) interface{} {
	return &query.QueryDataResponse{}
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
			}, newChunkedWriter(w)); err != nil {
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
				&query.QueryDataResponse{QueryDataResponse: backend.QueryDataResponse{Responses: map[string]backend.DataResponse{
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
		responder.Object(query.GetResponseCode(rsp),
			&query.QueryDataResponse{QueryDataResponse: *rsp},
		)
	}), nil
}

func isRequestingChunkedResponse(accept string) bool {
	return accept == "text/event-stream"
}

func newChunkedWriter(w http.ResponseWriter) backend.ChunkedDataWriter {
	s := jsoniter.NewStream(jsoniter.ConfigCompatibleWithStandardLibrary, w, 1024*10)
	return backend.NewChunkedDataWriter(true, // force JSON
		func(chunk *pluginv2.QueryChunkedDataResponse) error {
			s.WriteRaw("data: ")
			s.WriteObjectStart()
			s.WriteObjectField("refId")
			s.WriteString(chunk.RefId)

			if chunk.FrameId != "" {
				s.WriteMore()
				s.WriteObjectField("frameId")
				s.WriteString(chunk.FrameId)
			}

			if chunk.Frame != nil {
				// Make sure it is JSON (currently always Arrow so this raw client is just extra work!)
				if chunk.Frame[0] != '{' {
					frame, err := data.UnmarshalArrowFrame(chunk.Frame)
					if err != nil {
						return err
					}
					chunk.Frame, err = frame.MarshalJSON()
					if err != nil {
						return err
					}
				}

				// Replace any newlines with a space
				// NOTE: this should only happen if the frames were pretty printed
				str := strings.ReplaceAll(string(chunk.Frame), "\n", " ")

				s.WriteMore()
				s.WriteObjectField("frame")
				s.WriteRaw(str)
			}

			if chunk.Error != "" {
				s.WriteMore()
				s.WriteObjectField("error")
				s.WriteString(chunk.Error)
			}

			if chunk.Error != "" {
				s.WriteMore()
				s.WriteObjectField("errorSource")
				s.WriteString(chunk.ErrorSource)
			}

			s.WriteObjectEnd()
			s.WriteRaw("\n\n") // marks the end of a message in SSE
			return s.Flush()
		})
}
