package cloudwatch

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/models"
)

type LogQueryRunnerSupplier struct {
	Publisher models.ChannelPublisher
	Service   *LogsService
}

type logQueryRunner struct {
	channelName string
	publish     models.ChannelPublisher
	running     map[string]bool
	runningMu   sync.Mutex
	service     *LogsService
}

// GetHandlerForPath gets the channel handler for a certain path.
func (s *LogQueryRunnerSupplier) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return &logQueryRunner{
		channelName: path,
		publish:     s.Publisher,
		running:     make(map[string]bool),
		service:     s.Service,
	}, nil
}

// OnSubscribe publishes results from the corresponding CloudWatch Logs query to the provided channel
func (r *logQueryRunner) OnSubscribe(ctx context.Context, user *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	r.runningMu.Lock()
	defer r.runningMu.Unlock()

	if _, ok := r.running[e.Channel]; ok {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusOK, nil
	}

	r.running[e.Channel] = true
	go func() {
		if err := r.publishResults(user.OrgId, e.Channel); err != nil {
			plog.Error(err.Error())
		}
	}()

	return models.SubscribeReply{}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish checks if a message from the websocket can be broadcast on this channel
func (r *logQueryRunner) OnPublish(ctx context.Context, user *models.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	return models.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}

func (r *logQueryRunner) publishResults(orgID int64, channelName string) error {
	defer func() {
		r.service.DeleteResponseChannel(channelName)
		r.runningMu.Lock()
		delete(r.running, channelName)
		r.runningMu.Unlock()
	}()

	responseChannel, err := r.service.GetResponseChannel(channelName)
	if err != nil {
		return err
	}

	for response := range responseChannel {
		responseBytes, err := json.Marshal(response)
		if err != nil {
			return err
		}

		if err := r.publish(orgID, channelName, responseBytes); err != nil {
			return err
		}
	}

	return nil
}

func groupResponseFrame(frame *data.Frame, statsGroups []string) (data.Frames, error) {
	var dataFrames data.Frames

	// When a query of the form "stats ... by ..." is made, we want to return
	// one series per group defined in the query, but due to the format
	// the query response is in, there does not seem to be a way to tell
	// by the response alone if/how the results should be grouped.
	// Because of this, if the frontend sees that a "stats ... by ..." query is being made
	// the "statsGroups" parameter is sent along with the query to the backend so that we
	// can correctly group the CloudWatch logs response.
	// Check if we have time field though as it makes sense to split only for time series.
	if hasTimeField(frame) {
		if len(statsGroups) > 0 && len(frame.Fields) > 0 {
			groupedFrames, err := groupResults(frame, statsGroups)
			if err != nil {
				return nil, err
			}

			dataFrames = groupedFrames
		} else {
			setPreferredVisType(frame, "logs")
			dataFrames = data.Frames{frame}
		}
	} else {
		dataFrames = data.Frames{frame}
	}
	return dataFrames, nil
}

func hasTimeField(frame *data.Frame) bool {
	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeNullableTime {
			return true
		}
	}
	return false
}

func setPreferredVisType(frame *data.Frame, visType data.VisType) {
	if frame.Meta != nil {
		frame.Meta.PreferredVisualization = visType
	} else {
		frame.Meta = &data.FrameMeta{
			PreferredVisualization: visType,
		}
	}
}
