package tempo

import (
	"context"
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"strings"
)

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	s.tlog.Debug("Allowing access to stream", "path", req.Path, "user", req.PluginContext.User)
	status := backend.SubscribeStreamStatusPermissionDenied
	if strings.HasPrefix(req.Path, SearchPathPrefix) {
		status = backend.SubscribeStreamStatusOK
	}

	return &backend.SubscribeStreamResponse{
		Status: status,
	}, nil
}

func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	s.tlog.Debug("PublishStream called")

	// Do not allow publishing at all.
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (s *Service) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error {
	s.tlog.Debug("New stream call", "path", request.Path, "json", string(request.Data))

	if strings.HasPrefix(request.Path, SearchPathPrefix) {
		return s.SearchRequests.runStream(request, sender)
	}

	return fmt.Errorf("unknown path %s", request.Path)
}
