package tempo

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	stream_utils "github.com/grafana/grafana/pkg/tsdb/tempo/utils"
	"google.golang.org/grpc/metadata"
)

func (s *Service) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	s.logger.Debug("Allowing access to stream", "path", req.Path, "user", req.PluginContext.User)

	if strings.HasPrefix(req.Path, SearchPathPrefix) {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusOK,
		}, nil
	}

	if strings.HasPrefix(req.Path, MetricsPathPrefix) {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusOK,
		}, nil
	}

	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusPermissionDenied,
	}, backend.DownstreamErrorf("stream path not supported: %s", req.Path)
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
	tempoDatasource, dsInfoErr := s.getDSInfo(ctx, request.PluginContext)
	if dsInfoErr != nil {
		return backend.DownstreamErrorf("failed to get datasource information: %w", dsInfoErr)
	}

	// get incoming and team http headers and append to stream request.
	headers, err := stream_utils.GetHeadersFromIncomingContext(ctx, s.logger)
	if err != nil {
		return err
	}
	request.Headers = headers

	// add them to the outgoing context.
	// this is mainly needed for the api server as in that case, the outgoing context is empty and it is the incoming context that contains the metadata (if any)
	for key, value := range headers {
		ctx = metadata.AppendToOutgoingContext(ctx, key, value)
	}

	if strings.HasPrefix(request.Path, SearchPathPrefix) {
		if err = s.runSearchStream(ctx, request, sender, tempoDatasource); err != nil {
			return sendError(err, sender)
		} else {
			return nil
		}
	}
	if strings.HasPrefix(request.Path, MetricsPathPrefix) {
		if err = s.runMetricsStream(ctx, request, sender, tempoDatasource); err != nil {
			return sendError(err, sender)
		} else {
			return nil
		}
	}

	return fmt.Errorf("unknown path %s", request.Path)
}
