package live

import (
	"context"
	"errors"

	"github.com/grafana/grafana-live-sdk/telemetry"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana-live-sdk/telemetry/telegraf"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type Demultiplexer struct {
	streamID                      string
	managedStreamRunner           *ManagedStreamRunner
	telegrafConverterWide         *telegraf.Converter
	telegrafConverterLabelsColumn *telegraf.Converter
}

func NewDemultiplexer(streamID string, managedStreamRunner *ManagedStreamRunner) *Demultiplexer {
	return &Demultiplexer{
		streamID:                      streamID,
		managedStreamRunner:           managedStreamRunner,
		telegrafConverterWide:         telegraf.NewConverter(),
		telegrafConverterLabelsColumn: telegraf.NewConverter(telegraf.WithUseLabelsColumn(true)),
	}
}

func (s *Demultiplexer) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return s, nil
}

func (s *Demultiplexer) OnSubscribe(_ context.Context, _ *models.SignedInUser, _ models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
}

func (s *Demultiplexer) OnPublish(ctx context.Context, _ *models.SignedInUser, evt models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	urlValues, ok := getContextValues(ctx)
	if !ok {
		return models.PublishReply{}, 0, errors.New("error extracting context url values")
	}

	var converter telemetry.Converter
	frameFormat := urlValues.Get("gf_live_frame_format")
	if frameFormat == "" {
		frameFormat = "wide"
	}
	switch frameFormat {
	case "wide":
		converter = s.telegrafConverterWide
	case "labels_column":
		converter = s.telegrafConverterLabelsColumn
	default:
		logger.Error("Unsupported frame format", "format", frameFormat)
		return models.PublishReply{}, 0, errors.New("unsupported frame format")
	}

	var stableSchema bool
	if urlValues.Get("gf_live_stable_schema") != "" {
		stableSchema = true
	}

	logger.Debug("Live Push request body",
		"protocol", "ws",
		"streamId", s.streamID,
		"bodyLength", len(evt.Data),
		"stableSchema", stableSchema,
		"frameFormat", frameFormat,
	)

	stream, err := s.managedStreamRunner.GetOrCreateStream(s.streamID)
	if err != nil {
		logger.Error("Error getting stream", "error", err, "streamId", s.streamID)
		return models.PublishReply{}, 0, err
	}
	metricFrames, err := converter.Convert(evt.Data)
	if err != nil {
		logger.Error("Error converting metrics", "error", err, "data", string(evt.Data))
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
