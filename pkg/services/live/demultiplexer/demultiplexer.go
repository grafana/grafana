package demultiplexer

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/pushurl"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("live.push_ws")
)

type Demultiplexer struct {
	streamID            string
	managedStreamRunner *managedstream.Runner
	converter           *convert.Converter
}

func New(streamID string, managedStreamRunner *managedstream.Runner) *Demultiplexer {
	return &Demultiplexer{
		streamID:            streamID,
		managedStreamRunner: managedStreamRunner,
		converter:           convert.NewConverter(),
	}
}

func (s *Demultiplexer) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return s, nil
}

func (s *Demultiplexer) OnSubscribe(_ context.Context, _ *models.SignedInUser, _ models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
}

func (s *Demultiplexer) OnPublish(ctx context.Context, _ *models.SignedInUser, evt models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	urlValues, ok := livecontext.GetContextValues(ctx)
	if !ok {
		return models.PublishReply{}, 0, errors.New("error extracting context url values")
	}

	stream, err := s.managedStreamRunner.GetOrCreateStream(s.streamID)
	if err != nil {
		logger.Error("Error getting stream", "error", err, "streamId", s.streamID)
		return models.PublishReply{}, 0, err
	}

	frameFormat := pushurl.FrameFormatFromValues(urlValues)
	stableSchema := pushurl.StableSchemaFromValues(urlValues)

	logger.Debug("Live Push request",
		"protocol", "ws",
		"streamId", s.streamID,
		"bodyLength", len(evt.Data),
		"stableSchema", stableSchema,
		"frameFormat", frameFormat,
	)

	metricFrames, err := s.converter.Convert(evt.Data, frameFormat)
	if err != nil {
		logger.Error("Error converting metrics", "error", err, "data", string(evt.Data), "frameFormat", frameFormat)
		return models.PublishReply{}, 0, err
	}
	for _, mf := range metricFrames {
		err := stream.Push(mf.Key(), mf.Frame(), stableSchema)
		if err != nil {
			return models.PublishReply{}, 0, err
		}
	}
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}
