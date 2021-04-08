package live

import (
	"context"

	"github.com/grafana/grafana-live-sdk/telemetry/telegraf"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

type Multiplexer struct {
	telegrafConverterWide *telegraf.Converter
	managedStreamRunner   *ManagedStreamRunner
}

func NewMultiplexer(managedStreamRunner *ManagedStreamRunner) *Multiplexer {
	return &Multiplexer{
		telegrafConverterWide: telegraf.NewConverter(),
		managedStreamRunner:   managedStreamRunner,
	}
}

func (s *Multiplexer) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return s, nil
}

func (s *Multiplexer) OnSubscribe(_ context.Context, _ *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := models.SubscribeReply{}
	return reply, backend.SubscribeStreamStatusOK, nil
}

func (s *Multiplexer) OnPublish(_ context.Context, _ *models.SignedInUser, evt models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	stream, err := s.managedStreamRunner.GetOrCreateStream("archer")
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		return models.PublishReply{}, 0, err
	}
	metricFrames, err := s.telegrafConverterWide.Convert(evt.Data)
	if err != nil {
		logger.Error("Error converting metrics", "error", err)
		return models.PublishReply{}, 0, err
	}
	for _, mf := range metricFrames {
		err := stream.Push(mf.Key(), mf.Frame())
		if err != nil {
			return models.PublishReply{}, 0, err
		}
	}
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}
