package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	util "github.com/grafana/grafana/pkg/util/retryer"
	uuid "github.com/satori/go.uuid"
	"golang.org/x/sync/errgroup"
)

type LogQueryRunnerSupplier struct {
}

type LogQueryRunner struct {
	channelName string
	publish     models.ChannelPublisher
	running     map[string]bool
}

const (
	maxAttempts   = 8
	minRetryDelay = 500 * time.Millisecond
	maxRetryDelay = 30 * time.Second
)

var (
	channelMu        = sync.Mutex{}
	responseChannels = map[string]chan *tsdb.Response{}
)

func addResponseChannel(name string, channel chan *tsdb.Response) error {
	channelMu.Lock()
	defer channelMu.Unlock()

	if _, ok := responseChannels[name]; ok {
		return fmt.Errorf("channel with name '%s' already exists", name)
	}

	responseChannels[name] = channel
	return nil
}

func getResponseChannel(name string) (chan *tsdb.Response, error) {
	channelMu.Lock()
	defer channelMu.Unlock()

	if responseChannel, ok := responseChannels[name]; ok {
		return responseChannel, nil
	}

	return nil, fmt.Errorf("channel with name '%s' not found", name)
}

// GetHandlerForPath gets called on init.
func (supplier *LogQueryRunnerSupplier) GetHandlerForPath(path string, publisher models.ChannelPublisher) (models.ChannelHandler, error) {
	return &LogQueryRunner{
		channelName: path,
		publish:     publisher,
		running:     make(map[string]bool),
	}, nil
}

// GetChannelOptions gets channel options.
// It's called fast and often.
func (g *LogQueryRunner) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (g *LogQueryRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	if _, ok := g.running[e.Channel]; !ok {
		g.running[e.Channel] = true
		go g.publishResults(e.Channel)
	}

	return nil
}

// OnPublish is called when an event is received from the websocket.
func (g *LogQueryRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	return nil, fmt.Errorf("can not publish")
}

func (g *LogQueryRunner) publishResults(channelName string) error {
	defer func() {
		delete(responseChannels, channelName)
		delete(g.running, channelName)
	}()

	responseChannel, err := getResponseChannel(channelName)
	if err != nil {
		return err
	}

	for response := range responseChannel {
		responseBytes, err := json.Marshal(response)
		if err != nil {
			return err
		}

		g.publish(channelName, responseBytes)
	}

	return nil
}

func (e *cloudWatchExecutor) executeLiveLogQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	responseChannelName := uuid.Must(uuid.NewV4()).String()
	responseChannel := make(chan *tsdb.Response)
	addResponseChannel("plugin/cloudwatch/"+responseChannelName, responseChannel)
	requestContext, _ := context.WithTimeout(context.Background(), 15*time.Minute)
	go e.sendQueriesToChannel(requestContext, queryContext, responseChannel)

	response := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			"A": {
				RefId: "A",
				Meta: simplejson.NewFromAny(map[string]interface{}{
					"channelName": responseChannelName,
				}),
			},
		},
	}

	return response, nil
}

func (e *cloudWatchExecutor) sendQueriesToChannel(ctx context.Context, queryContext *tsdb.TsdbQuery, responseChannel chan *tsdb.Response) {
	eg, ectx := errgroup.WithContext(ctx)

	for _, query := range queryContext.Queries {
		query := query
		eg.Go(func() error {
			return e.startQuery(ectx, responseChannel, query, queryContext.TimeRange)
		})
	}

	if err := eg.Wait(); err != nil {
		plog.Error(err.Error())
	}

	close(responseChannel)
}

func (e *cloudWatchExecutor) startQuery(ctx context.Context, responseChannel chan *tsdb.Response, query *tsdb.Query, timeRange *tsdb.TimeRange) error {
	defaultRegion := e.DataSource.JsonData.Get("defaultRegion").MustString()
	parameters := query.Model
	region := parameters.Get("region").MustString(defaultRegion)
	logsClient, err := e.getCWLogsClient(region)
	if err != nil {
		return err
	}

	queue, err := e.getQueue(region)
	if err != nil {
		return err
	}

	queue <- true
	defer func() { <-queue }()

	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, parameters, timeRange)
	if err != nil {
		return err
	}

	queryResultsInput := &cloudwatchlogs.GetQueryResultsInput{
		QueryId: startQueryOutput.QueryId,
	}

	recordsMatched := 0.0
	util.Retry(func() (util.RetrySignal, error) {
		getQueryResultsOutput, err := logsClient.GetQueryResultsWithContext(ctx, queryResultsInput)
		if err != nil {
			return util.FuncError, err
		}

		retryNeeded := *getQueryResultsOutput.Statistics.RecordsMatched <= recordsMatched
		recordsMatched = *getQueryResultsOutput.Statistics.RecordsMatched

		dataFrame, err := logsResultsToDataframes(getQueryResultsOutput)
		if err != nil {
			return util.FuncError, err
		}

		dataFrame.Name = query.RefId
		dataFrame.RefID = query.RefId
		dataFrames := data.Frames{}

		// When a query of the form "stats ... by ..." is made, we want to return
		// one series per group defined in the query, but due to the format
		// the query response is in, there does not seem to be a way to tell
		// by the response alone if/how the results should be grouped.
		// Because of this, if the frontend sees that a "stats ... by ..." query is being made
		// the "statsGroups" parameter is sent along with the query to the backend so that we
		// can correctly group the CloudWatch logs response.
		statsGroups := parameters.Get("statsGroups").MustStringArray()
		if len(statsGroups) > 0 && len(dataFrame.Fields) > 0 {
			groupedFrames, err := groupResults(dataFrame, statsGroups)
			if err != nil {
				return util.FuncError, err
			}

			dataFrames = groupedFrames
		} else {
			if dataFrame.Meta != nil {
				dataFrame.Meta.PreferredVisualization = "logs"
			} else {
				dataFrame.Meta = &data.FrameMeta{
					PreferredVisualization: "logs",
				}
			}

			dataFrames = data.Frames{dataFrame}
		}

		responseChannel <- &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				query.RefId: {
					RefId:      query.RefId,
					Dataframes: tsdb.NewDecodedDataFrames(dataFrames),
				},
			},
		}

		if isTerminated(*getQueryResultsOutput.Status) {
			return util.FuncComplete, nil
		} else if retryNeeded {
			return util.FuncFailure, nil
		} else {
			return util.FuncSuccess, nil
		}
	}, maxAttempts, minRetryDelay, maxRetryDelay)

	return nil
}
