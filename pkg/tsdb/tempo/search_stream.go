package tempo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
)

const SearchPathPrefix = "search/"

type ExtendedResponse struct {
	*tempopb.SearchResponse
	State dataquery.SearchStreamingState
}

type StreamSender interface {
	SendFrame(frame *data.Frame, include data.FrameInclude) error
	SendJSON(data []byte) error
	SendBytes(data []byte) error
}

func (s *Service) runSearchStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender, datasource *Datasource) error {
	response := &backend.DataResponse{}

	var backendQuery *backend.DataQuery
	err := json.Unmarshal(req.Data, &backendQuery)
	if err != nil {
		response.Error = fmt.Errorf("error unmarshaling backend query model: %v", err)
		return err
	}

	var sr *tempopb.SearchRequest
	err = json.Unmarshal(req.Data, &sr)
	if err != nil {
		response.Error = fmt.Errorf("error unmarshaling Tempo query model: %v", err)
		return err
	}

	if sr.GetQuery() == "" {
		return fmt.Errorf("query is empty")
	}

	sr.Start = uint32(backendQuery.TimeRange.From.Unix())
	sr.End = uint32(backendQuery.TimeRange.To.Unix())

	stream, err := datasource.StreamingClient.Search(ctx, sr)
	if err != nil {
		s.logger.Error("Error Search()", "err", err)
		return err
	}

	return s.processStream(stream, sender)
}

func (s *Service) processStream(stream tempopb.StreamingQuerier_SearchClient, sender StreamSender) error {
	var traceList []*tempopb.TraceSearchMetadata
	var metrics *tempopb.SearchMetrics
	for {
		msg, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			if err := sendResponse(&ExtendedResponse{
				State: dataquery.SearchStreamingStateDone,
				SearchResponse: &tempopb.SearchResponse{
					Metrics: metrics,
					Traces:  traceList,
				},
			}, sender); err != nil {
				return err
			}
			break
		}
		if err != nil {
			s.logger.Error("Error receiving message", "err", err)
			return err
		}

		metrics = msg.Metrics
		traceList = append(traceList, msg.Traces...)
		traceList = removeDuplicates(traceList)

		if err := sendResponse(&ExtendedResponse{
			State: dataquery.SearchStreamingStateStreaming,
			SearchResponse: &tempopb.SearchResponse{
				Metrics: metrics,
				Traces:  traceList,
			},
		}, sender); err != nil {
			return err
		}
	}

	return nil
}

func sendResponse(response *ExtendedResponse, sender StreamSender) error {
	frame := createResponseDataFrame()

	if response != nil {
		tracesAsJson, err := json.Marshal(response.Traces)
		if err != nil {
			return err
		}
		tracesRawMessage := json.RawMessage(tracesAsJson)
		frame.Fields[0].Append(tracesRawMessage)

		metricsAsJson, err := json.Marshal(response.Metrics)
		if err != nil {
			return err
		}
		metricsRawMessage := json.RawMessage(metricsAsJson)
		frame.Fields[1].Append(metricsRawMessage)
		frame.Fields[2].Append(string(response.State))
		frame.Fields[3].Append("")
	}

	return sender.SendFrame(frame, data.IncludeAll)
}

func sendError(searchErr error, sender StreamSender) error {
	frame := createResponseDataFrame()

	if searchErr != nil {
		frame.Fields[0].Append(json.RawMessage{})
		frame.Fields[1].Append(json.RawMessage{})
		frame.Fields[2].Append(string(dataquery.SearchStreamingStateError))
		frame.Fields[3].Append(searchErr.Error())
	}

	return sender.SendFrame(frame, data.IncludeAll)
}

func createResponseDataFrame() *data.Frame {
	frame := data.NewFrame("response")
	frame.Fields = append(frame.Fields, data.NewField("traces", nil, []json.RawMessage{}))
	frame.Fields = append(frame.Fields, data.NewField("metrics", nil, []json.RawMessage{}))
	frame.Fields = append(frame.Fields, data.NewField("state", nil, []string{}))
	frame.Fields = append(frame.Fields, data.NewField("error", nil, []string{}))

	return frame
}

func removeDuplicates(traceList []*tempopb.TraceSearchMetadata) []*tempopb.TraceSearchMetadata {
	keys := make(map[string]bool)
	var list []*tempopb.TraceSearchMetadata

	for _, entry := range traceList {
		if _, value := keys[entry.TraceID]; !value {
			keys[entry.TraceID] = true
			list = append(list, entry)
		}
	}
	return list
}
