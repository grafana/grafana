package datasource

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
)

type CorePluginResourceHandler struct {
	client PluginClient
}

func NewCorePluginResourceHandler(client PluginClient) *CorePluginResourceHandler {
	return &CorePluginResourceHandler{
		client: client,
	}
}

func (r *CorePluginResourceHandler) Handle(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		clonedReq, err := resourceRequest(req)
		if err != nil {
			responder.Error(err)
			return
		}

		body, err := io.ReadAll(req.Body)
		if err != nil {
			responder.Error(err)
			return
		}

		err = r.client.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: pluginCtx,
			Path:          clonedReq.URL.Path,
			Method:        req.Method,
			URL:           clonedReq.URL.String(),
			Body:          body,
			Headers:       req.Header,
		}, httpresponsesender.New(w))

		if err != nil {
			responder.Error(err)
		}
	}), nil
}

func resourceRequest(req *http.Request) (*http.Request, error) {
	idx := strings.LastIndex(req.URL.Path, "/resource")
	if idx < 0 {
		return nil, fmt.Errorf("expected resource path") // 400?
	}

	clonedReq := req.Clone(req.Context())
	rawURL := strings.TrimLeft(req.URL.Path[idx+len("/resource"):], "/")

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, nil
}

type ExternalPluginResourceHandler struct {
	client PluginProtoClient
}

func NewExternalPluginResourceHandler(client PluginProtoClient) *ExternalPluginResourceHandler {
	return &ExternalPluginResourceHandler{
		client: client,
	}
}

func (r *ExternalPluginResourceHandler) Handle(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		clonedReq, err := resourceRequest(req)
		if err != nil {
			responder.Error(err)
			return
		}

		body, err := io.ReadAll(req.Body)
		if err != nil {
			responder.Error(err)
			return
		}

		headers := make(map[string]*pluginv2.StringList, len(req.Header))
		for k, values := range req.Header {
			headers[k] = &pluginv2.StringList{Values: values}
		}

		protoStream, err := r.client.CallResource(ctx, &pluginv2.CallResourceRequest{
			PluginContext: backend.ToProto().PluginContext(pluginCtx),
			Path:          clonedReq.URL.Path,
			Method:        req.Method,
			Url:           clonedReq.URL.String(),
			Body:          body,
			Headers:       headers,
		})

		server := httpresponsesender.New(w)

		for {
			protoResp, err := protoStream.Recv()
			if err != nil {
				if errors.Is(err, io.EOF) {
					break
				}

				responder.Error(err)
				return
			}

			if err = server.Send(backend.FromProto().CallResourceResponse(protoResp)); err != nil {
				responder.Error(err)
				return
			}
		}
	}), nil
}
