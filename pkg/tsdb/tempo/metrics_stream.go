package tempo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/grafana/grafana/pkg/tsdb/tempo/traceql"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

const MetricsPathPrefix = "metrics/"

func (s *Service) runMetricsStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender, datasource *Datasource) error {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.tempo.runMetricsStream")
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

	var qrr *tempopb.QueryRangeRequest
	err = json.Unmarshal(req.Data, &qrr)
	if err != nil {
		response.Error = fmt.Errorf("error unmarshaling Tempo query model: %v", err)
		span.RecordError(response.Error)
		span.SetStatus(codes.Error, response.Error.Error())
		return err
	}

	if qrr.GetQuery() == "" {
		return fmt.Errorf("query is empty")
	}

	qrr.Start = uint64(backendQuery.TimeRange.From.UnixNano())
	qrr.End = uint64(backendQuery.TimeRange.To.UnixNano())

	// Setting the user agent for the gRPC call. When DS is decoupled we don't recreate instance when grafana config
	// changes or updates, so we have to get it from context.
	// Ideally this would be pushed higher, so it's set once for all rpc calls, but we have only one now.
	ctx = metadata.AppendToOutgoingContext(ctx, "User-Agent", backend.UserAgentFromContext(ctx).String())

	stream, err := datasource.StreamingClient.MetricsQueryRange(ctx, qrr)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("Error Search()", "err", err)
		return err
	}

	return s.processMetricsStream(ctx, qrr.Query, stream, sender)
}

func (s *Service) processMetricsStream(ctx context.Context, query string, stream tempopb.StreamingQuerier_MetricsQueryRangeClient, sender StreamSender) error {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.tempo.processStream")
	defer span.End()
	messageCount := 0
	for {
		msg, err := stream.Recv()
		messageCount++
		span.SetAttributes(attribute.Int("message_count", messageCount))
		if errors.Is(err, io.EOF) {
			if err := s.sendResponse(ctx, nil, nil, dataquery.SearchStreamingStateDone, sender); err != nil {
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

		transformed := traceql.TransformMetricsResponse(query, *msg)

		if err := s.sendResponse(ctx, transformed, msg.Metrics, dataquery.SearchStreamingStateStreaming, sender); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return err
		}
	}

	return nil
}
