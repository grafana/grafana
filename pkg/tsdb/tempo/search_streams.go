package tempo

import (
	"context"
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/tempo/pkg/tempopb"
	"io"
	"sync"
)

type SearchRequests struct {
	logger log.Logger

	// The running instances
	requests map[string]*tempopb.SearchRequest

	// safe changes
	mutex sync.Mutex
}

const SearchPathPrefix = "search/"

func (s *SearchRequests) add(key string, request *tempopb.SearchRequest) error {
	if key == "" {
		return fmt.Errorf("invalid key %s", key)
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.requests[key] = request
	return nil
}

func NewSearchStreams() *SearchRequests {
	s := &SearchRequests{
		requests: make(map[string]*tempopb.SearchRequest),
		logger:   log.New("tsdb.tempo.search_streams"),
	}
	return s
}

func (s *SearchRequests) runStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender, tempoDatasource *TempoDatasource) error {
	s.logger.Info("Running stream", "path", req.Path, "req", req)
	sr, err := s.getRequestFromPath(req.Path) // includes sim
	if err != nil {
		return err
	}

	s.logger.Info("Calling Search", "search request", sr)
	stream, err := tempoDatasource.StreamingClient.Search(ctx, sr)
	if err != nil {
		s.logger.Error("Error Search()", "err", err)
	}

	mainFrame := s.createResponseDataFrame()
	var subFrames []*data.Frame

	// receive stream
	for {
		// read next message
		msg, err := stream.Recv()
		if err == io.EOF {
			// read done.
			break
		}
		if err != nil {
			s.logger.Error("Error receiving message", "err", err)
			return err
		}

		s.logger.Info("Received message", "message", msg)

		// iterate over msg.Traces and add to frame
		for index, trace := range msg.Traces {
			s.addTraceToDataFrame(mainFrame, trace)

			// transform trace.spanSet to data.Frame and send
			spanFrame := s.spanSetToDataFrame(trace, index)
			subFrames = append(subFrames, spanFrame)
		}

		// join mainFrame and subFrames in a new array
		allFrames := data.Frames{}
		allFrames = append(allFrames, mainFrame)
		allFrames = append(allFrames, subFrames...)

		s.logger.Info("Sending frames", "frames", len(allFrames))

		// marshal allFrames to JSON and send
		allFramesAsJson, err := allFrames.MarshalJSON()
		if err != nil {
			return err
		}

		s.logger.Info("Sending frames", "allFramesAsJson", allFramesAsJson)

		err = sender.SendJSON(allFramesAsJson)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *SearchRequests) addTraceToDataFrame(df *data.Frame, trace *tempopb.TraceSearchMetadata) {
	df.AppendRow()
	df.Fields[0].Append(trace.GetTraceID())
	df.Fields[1].Append(trace.GetStartTimeUnixNano())
	df.Fields[2].Append(trace.GetRootTraceName())
	df.Fields[3].Append(trace.GetRootServiceName())
	df.Fields[4].Append(trace.GetDurationMs())
}

func (s *SearchRequests) createResponseDataFrame() *data.Frame {
	frame := data.NewFrame("response")
	frame.Fields = append(frame.Fields, data.NewField("traceId", nil, []string{}))
	frame.Fields = append(frame.Fields, data.NewField("startTime", nil, []uint64{}))
	frame.Fields = append(frame.Fields, data.NewField("traceName", nil, []string{}))
	frame.Fields = append(frame.Fields, data.NewField("serviceName", nil, []string{}))
	frame.Fields = append(frame.Fields, data.NewField("traceDuration", nil, []uint32{}))

	return frame
}

func (s *SearchRequests) spanSetToDataFrame(trace *tempopb.TraceSearchMetadata, currentIndex int) *data.Frame {
	frame := data.NewFrame(trace.GetTraceID())
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: "table",
		Custom: map[string]interface{}{
			"parentRowIndex": currentIndex,
		},
	}
	frame.Fields = append(frame.Fields, data.NewField("traceId", nil, []string{}))
	frame.Fields = append(frame.Fields, data.NewField("spanId", nil, []string{}))
	frame.Fields = append(frame.Fields, data.NewField("startTime", nil, []uint64{}))
	frame.Fields = append(frame.Fields, data.NewField("name", nil, []string{}))
	frame.Fields = append(frame.Fields, data.NewField("duration", nil, []uint64{}))

	for _, span := range trace.GetSpanSet().GetSpans() {
		frame.AppendRow()
		frame.Fields[0].Append(trace.GetTraceID())
		frame.Fields[1].Append(span.GetSpanID())
		frame.Fields[2].Append(span.GetStartTimeUnixNano())
		frame.Fields[3].Append(span.GetName())
		frame.Fields[4].Append(span.GetDurationNanos())
	}

	return frame
}

func (s *SearchRequests) getRequestFromPath(path string) (*tempopb.SearchRequest, error) {
	req, ok := s.requests[path]
	if !ok {
		return nil, fmt.Errorf("unable to find request for key %s", path)
	}
	return req, nil
}
