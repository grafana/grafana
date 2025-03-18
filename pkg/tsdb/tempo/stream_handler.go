package tempo

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (s *Service) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	s.logger.Debug("Allowing access to stream", "path", req.Path, "user", req.PluginContext.User)
	status := backend.SubscribeStreamStatusPermissionDenied
	if strings.HasPrefix(req.Path, SearchPathPrefix) {
		status = backend.SubscribeStreamStatusOK
	}
	if strings.HasPrefix(req.Path, MetricsPathPrefix) {
		status = backend.SubscribeStreamStatusOK
	}

	return &backend.SubscribeStreamResponse{
		Status: status,
	}, nil
}

func (s *Service) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	s.logger.Debug("PublishStream called")

	// Do not allow publishing at all.
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (s *Service) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error {
	s.logger.Debug("New stream call", "path", request.Path)
	tempoDatasource, err := s.getDSInfo(ctx, request.PluginContext)

	if strings.HasPrefix(request.Path, SearchPathPrefix) {
		if err != nil {
			return err
		}
		if err = s.runSearchStream(ctx, request, sender, tempoDatasource); err != nil {
			return sendError(err, sender)
		} else {
			return nil
		}
	}
	if strings.HasPrefix(request.Path, MetricsPathPrefix) {
		if err != nil {
			return err
		}
		if err = s.runMetricsStream(ctx, request, sender, tempoDatasource); err != nil {
			return sendError(err, sender)
		} else {
			return nil
		}
	}

	return fmt.Errorf("unknown path %s", request.Path)
}
