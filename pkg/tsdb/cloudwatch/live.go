package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/servicequotas"
	"github.com/aws/aws-sdk-go/service/servicequotas/servicequotasiface"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/retryer"
	"golang.org/x/sync/errgroup"
)

const defaultConcurrentQueries = 4

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

const (
	maxAttempts   = 8
	minRetryDelay = 500 * time.Millisecond
	maxRetryDelay = 30 * time.Second
)

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

// executeLiveLogQuery executes a CloudWatch Logs query with live updates over WebSocket.
// A WebSocket channel is created, which goroutines send responses over.
func (e *cloudWatchExecutor) executeLiveLogQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	responseChannelName := uuid.New().String()
	responseChannel := make(chan *backend.QueryDataResponse)
	if err := e.logsService.AddResponseChannel("plugin/cloudwatch/"+responseChannelName, responseChannel); err != nil {
		close(responseChannel)
		return nil, err
	}

	go e.sendLiveQueriesToChannel(req, responseChannel)

	response := &backend.QueryDataResponse{
		Responses: backend.Responses{
			"A": {
				Frames: data.Frames{data.NewFrame("A").SetMeta(&data.FrameMeta{
					Custom: map[string]interface{}{
						"channelName": responseChannelName,
					},
				})},
			},
		},
	}

	return response, nil
}

func (e *cloudWatchExecutor) sendLiveQueriesToChannel(req *backend.QueryDataRequest, responseChannel chan *backend.QueryDataResponse) {
	defer close(responseChannel)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	eg, ectx := errgroup.WithContext(ctx)

	for _, query := range req.Queries {
		query := query
		eg.Go(func() error {
			return e.startLiveQuery(ectx, responseChannel, query, query.TimeRange, req.PluginContext)
		})
	}

	if err := eg.Wait(); err != nil {
		plog.Error(err.Error())
	}
}

func (e *cloudWatchExecutor) getQueue(queueKey string, pluginCtx backend.PluginContext) (chan bool, error) {
	e.logsService.queueLock.Lock()
	defer e.logsService.queueLock.Unlock()

	if queue, ok := e.logsService.queues[queueKey]; ok {
		return queue, nil
	}

	concurrentQueriesQuota := e.fetchConcurrentQueriesQuota(queueKey, pluginCtx)

	queueChannel := make(chan bool, concurrentQueriesQuota)
	e.logsService.queues[queueKey] = queueChannel

	return queueChannel, nil
}

func (e *cloudWatchExecutor) fetchConcurrentQueriesQuota(region string, pluginCtx backend.PluginContext) int {
	sess, err := e.newSession(region, pluginCtx)
	if err != nil {
		plog.Warn("Could not get service quota client")
		return defaultConcurrentQueries
	}

	client := newQuotasClient(sess)

	concurrentQueriesQuota, err := client.GetServiceQuota(&servicequotas.GetServiceQuotaInput{
		ServiceCode: aws.String("logs"),
		QuotaCode:   aws.String("L-32C48FBB"),
	})
	if err != nil {
		plog.Warn("Could not get service quota")
		return defaultConcurrentQueries
	}

	if concurrentQueriesQuota != nil && concurrentQueriesQuota.Quota != nil && concurrentQueriesQuota.Quota.Value != nil {
		return int(*concurrentQueriesQuota.Quota.Value)
	}

	plog.Warn("Could not get service quota")

	defaultConcurrentQueriesQuota, err := client.GetAWSDefaultServiceQuota(&servicequotas.GetAWSDefaultServiceQuotaInput{
		ServiceCode: aws.String("logs"),
		QuotaCode:   aws.String("L-32C48FBB"),
	})
	if err != nil {
		plog.Warn("Could not get default service quota")
		return defaultConcurrentQueries
	}

	if defaultConcurrentQueriesQuota != nil && defaultConcurrentQueriesQuota.Quota != nil &&
		defaultConcurrentQueriesQuota.Quota.Value != nil {
		return int(*defaultConcurrentQueriesQuota.Quota.Value)
	}

	plog.Warn("Could not get default service quota")
	return defaultConcurrentQueries
}

func (e *cloudWatchExecutor) startLiveQuery(ctx context.Context, responseChannel chan *backend.QueryDataResponse, query backend.DataQuery, timeRange backend.TimeRange, pluginCtx backend.PluginContext) error {
	model, err := simplejson.NewJson(query.JSON)
	if err != nil {
		return err
	}

	dsInfo, err := e.getDSInfo(pluginCtx)
	if err != nil {
		return err
	}

	defaultRegion := dsInfo.region
	region := model.Get("region").MustString(defaultRegion)
	logsClient, err := e.getCWLogsClient(region, pluginCtx)
	if err != nil {
		return err
	}

	queue, err := e.getQueue(fmt.Sprintf("%s-%d", region, dsInfo.datasourceID), pluginCtx)
	if err != nil {
		return err
	}

	// Wait until there are no more active workers than the concurrent queries quota
	queue <- true
	defer func() { <-queue }()

	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, model, timeRange)
	if err != nil {
		responseChannel <- &backend.QueryDataResponse{
			Responses: backend.Responses{
				query.RefID: {Error: err},
			},
		}
		return err
	}

	queryResultsInput := &cloudwatchlogs.GetQueryResultsInput{
		QueryId: startQueryOutput.QueryId,
	}

	recordsMatched := 0.0
	return retryer.Retry(func() (retryer.RetrySignal, error) {
		getQueryResultsOutput, err := logsClient.GetQueryResultsWithContext(ctx, queryResultsInput)
		if err != nil {
			return retryer.FuncError, err
		}

		retryNeeded := *getQueryResultsOutput.Statistics.RecordsMatched <= recordsMatched
		recordsMatched = *getQueryResultsOutput.Statistics.RecordsMatched

		dataFrame, err := logsResultsToDataframes(getQueryResultsOutput)
		if err != nil {
			return retryer.FuncError, err
		}

		dataFrame.Name = query.RefID
		dataFrame.RefID = query.RefID
		dataFrames, err := groupResponseFrame(dataFrame, model.Get("statsGroups").MustStringArray())
		if err != nil {
			return retryer.FuncError, fmt.Errorf("failed to group dataframe response: %v", err)
		}

		responseChannel <- &backend.QueryDataResponse{
			Responses: backend.Responses{
				query.RefID: {
					Frames: dataFrames,
				},
			},
		}

		if isTerminated(*getQueryResultsOutput.Status) {
			return retryer.FuncComplete, nil
		} else if retryNeeded {
			return retryer.FuncFailure, nil
		}

		return retryer.FuncSuccess, nil
	}, maxAttempts, minRetryDelay, maxRetryDelay)
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

// Service quotas client factory.
//
// Stubbable by tests.
var newQuotasClient = func(sess *session.Session) servicequotasiface.ServiceQuotasAPI {
	client := servicequotas.New(sess)
	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})

	return client
}
