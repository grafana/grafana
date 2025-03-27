package tempo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
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
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.tempo.runSearchStream")
	defer span.End()

	response := &backend.DataResponse{}

	var backendQuery *backend.DataQuery
	err := json.Unmarshal(req.Data, &backendQuery)
	if err != nil {
		response.Error = fmt.Errorf("error unmarshaling backend query model: %v", err)
		span.RecordError(response.Error)
		span.SetStatus(codes.Error, response.Error.Error())
		return err
	}

	var sr *tempopb.SearchRequest
	err = json.Unmarshal(req.Data, &sr)
	if err != nil {
		response.Error = fmt.Errorf("error unmarshaling Tempo query model: %v", err)
		span.RecordError(response.Error)
		span.SetStatus(codes.Error, response.Error.Error())
		return err
	}

	if sr.GetQuery() == "" {
		return fmt.Errorf("query is empty")
	}

	sr.Start = uint32(backendQuery.TimeRange.From.Unix())
	sr.End = uint32(backendQuery.TimeRange.To.Unix())

	// Setting the user agent for the gRPC call. When DS is decoupled we don't recreate instance when grafana config
	// changes or updates, so we have to get it from context.
	// Ideally this would be pushed higher, so it's set once for all rpc calls, but we have only one now.
	ctx = metadata.AppendToOutgoingContext(ctx, "User-Agent", backend.UserAgentFromContext(ctx).String())

	stream, err := datasource.StreamingClient.Search(ctx, sr)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("Error Search()", "err", err)
		return err
	}

	return s.processStream(ctx, stream, sender)
}

func (s *Service) processStream(ctx context.Context, stream tempopb.StreamingQuerier_SearchClient, sender StreamSender) error {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.tempo.processStream")
	defer span.End()
	var traceList []*tempopb.TraceSearchMetadata
	var metrics *tempopb.SearchMetrics
	messageCount := 0
	for {
		msg, err := stream.Recv()
		messageCount++
		span.SetAttributes(attribute.Int("message_count", messageCount))
		if errors.Is(err, io.EOF) {
			if err := s.sendSearchResponse(ctx, &ExtendedResponse{
				State: dataquery.SearchStreamingStateDone,
				SearchResponse: &tempopb.SearchResponse{
					Metrics: metrics,
					Traces:  traceList,
				},
			}, sender); err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, err.Error())
				return err
			}
			break
		}
		if err != nil {
			s.logger.Error("Error receiving message", "err", err)
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return err
		}

		metrics = msg.Metrics
		traceList = append(traceList, msg.Traces...)
		traceList = removeDuplicates(traceList)
		span.SetAttributes(attribute.Int("traces_count", len(traceList)))

		if err := s.sendSearchResponse(ctx, &ExtendedResponse{
			State: dataquery.SearchStreamingStateStreaming,
			SearchResponse: &tempopb.SearchResponse{
				Metrics: metrics,
				Traces:  traceList,
			},
		}, sender); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return err
		}
	}

	return nil
}

func (s *Service) sendSearchResponse(ctx context.Context, response *ExtendedResponse, sender StreamSender) error {
	_, span := tracing.DefaultTracer().Start(ctx, "datasource.tempo.sendSearchResponse")
	defer span.End()
	frame := createResponseDataFrame()

	if response != nil {
		span.SetAttributes(attribute.Int("trace_count", len(response.Traces)), attribute.String("state", string(response.State)))
		return s.sendResponse(ctx, response.Traces, response.Metrics, response.State, sender)
	}

	return sender.SendFrame(frame, data.IncludeAll)
}

func (s *Service) sendResponse(ctx context.Context, result interface{}, metrics *tempopb.SearchMetrics, state dataquery.SearchStreamingState, sender StreamSender) error {
	_, span := tracing.DefaultTracer().Start(ctx, "datasource.tempo.sendResponse")
	defer span.End()
	frame := createResponseDataFrame()

	tracesAsJson, err := json.Marshal(result)
	if err != nil {
		return err
	}
	tracesRawMessage := json.RawMessage(tracesAsJson)
	frame.Fields[0].Append(tracesRawMessage)

	metricsAsJson, err := json.Marshal(metrics)
	if err != nil {
		return err
	}
	metricsRawMessage := json.RawMessage(metricsAsJson)
	frame.Fields[1].Append(metricsRawMessage)
	frame.Fields[2].Append(string(state))
	frame.Fields[3].Append("")

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
	frame.Fields = append(frame.Fields, data.NewField("result", nil, []json.RawMessage{}))
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
