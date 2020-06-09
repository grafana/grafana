package grpcplugin

import (
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func newCallResourceResultStream(stream pluginv2.Resource_CallResourceClient) backendplugin.CallResourceClientResponseStream {
	return &callResourceResultStream{
		stream: stream,
	}
}

type callResourceResultStream struct {
	stream pluginv2.Resource_CallResourceClient
}

func (s *callResourceResultStream) Recv() (*backend.CallResourceResponse, error) {
	protoResp, err := s.stream.Recv()
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return nil, backendplugin.ErrMethodNotImplemented
		}
		return nil, err
	}

	respHeaders := map[string][]string{}
	for key, values := range protoResp.Headers {
		respHeaders[key] = values.Values
	}

	return &backend.CallResourceResponse{
		Headers: respHeaders,
		Body:    protoResp.Body,
		Status:  int(protoResp.Code),
	}, nil
}

func (s *callResourceResultStream) Close() error {
	return s.stream.CloseSend()
}

func newSingleCallResourceResult(result *backend.CallResourceResponse) backendplugin.CallResourceClientResponseStream {
	return &singleCallResourceResult{
		result: result,
	}
}

type singleCallResourceResult struct {
	result *backend.CallResourceResponse
	done   bool
}

func (s *singleCallResourceResult) Recv() (*backend.CallResourceResponse, error) {
	if s.done {
		return nil, io.EOF
	}
	s.done = true
	return s.result, nil
}

func (s *singleCallResourceResult) Close() error {
	s.done = true
	return nil
}
