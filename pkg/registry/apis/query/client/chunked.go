package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
)

const chunkedQueryTypesFlag = "datasources.querier.chunked-types"

func useChunkedQuery(ctx context.Context, datasourceType string) bool {
	if info, ok := request.RequestInfoFrom(ctx); ok && info.Namespace != "" {
		ctx = openfeature.MergeTransactionContext(ctx, openfeature.NewEvaluationContext(info.Namespace, map[string]any{"namespace": info.Namespace}))
	}
	value := openfeature.NewDefaultClient().Object(ctx, chunkedQueryTypesFlag, map[string]any{"types": []any{}}, openfeature.TransactionContext(ctx))
	object, ok := value.(map[string]any)
	if !ok {
		return false
	}
	types, ok := object["types"].([]any)
	if !ok {
		return false
	}
	enabled := false
	for _, value := range types {
		dsType, ok := value.(string)
		if !ok {
			return false
		}
		enabled = enabled || dsType == datasourceType
	}
	return enabled
}

type chunkedQueryCollector struct {
	responses backend.Responses
	frames    map[string]map[string]*data.Frame
}

// Raw chunks preserve status and error source on error-only protobuf records.
var (
	_ backend.ChunkedDataWriter = (*chunkedQueryCollector)(nil)
	_ chunked.RawChunkReceiver  = (*chunkedQueryCollector)(nil)
)

func newChunkedQueryCollector() *chunkedQueryCollector {
	return &chunkedQueryCollector{responses: backend.Responses{}, frames: map[string]map[string]*data.Frame{}}
}

func (c *chunkedQueryCollector) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	if chunk == nil || chunk.RefId == "" {
		return errors.New("chunked query response is missing refId")
	}
	response, exists := c.responses[chunk.RefId]
	if !exists {
		response.Status = backend.StatusOK
	}
	if len(chunk.Frame) > 0 {
		if chunk.Format != pluginv2.DataFrameFormat_JSON {
			return fmt.Errorf("expected JSON chunked query frame, got %v", chunk.Format)
		}
		if c.frames[chunk.RefId] == nil {
			c.frames[chunk.RefId] = map[string]*data.Frame{}
		}
		previous := c.frames[chunk.RefId][chunk.FrameId]
		if chunk.FrameId != "" && previous != nil {
			var payload struct {
				Data *struct {
					Values []json.RawMessage `json:"values"`
				} `json:"data"`
			}
			if err := json.Unmarshal(chunk.Frame, &payload); err != nil {
				return fmt.Errorf("decoding chunked query frame: %w", err)
			}
			if payload.Data == nil || len(payload.Data.Values) != len(previous.Fields) {
				return errors.New("chunked query frame field count changed")
			}
			if err := data.AppendJSONData(previous, chunk.Frame); err != nil {
				return fmt.Errorf("appending chunked query frame: %w", err)
			}
		} else {
			var envelope struct {
				Schema json.RawMessage `json:"schema"`
				Data   json.RawMessage `json:"data"`
			}
			if err := json.Unmarshal(chunk.Frame, &envelope); err != nil {
				return fmt.Errorf("decoding chunked query frame: %w", err)
			}
			if len(envelope.Schema) == 0 || string(envelope.Schema) == "null" || len(envelope.Data) == 0 || string(envelope.Data) == "null" {
				return errors.New("first chunked query frame requires schema and data")
			}
			frame := &data.Frame{}
			if err := json.Unmarshal(chunk.Frame, frame); err != nil {
				return fmt.Errorf("decoding chunked query frame: %w", err)
			}
			if frame.RefID == "" {
				frame.RefID = chunk.RefId
			}
			response.Frames = append(response.Frames, frame)
			if chunk.FrameId != "" {
				c.frames[chunk.RefId][chunk.FrameId] = frame
			}
		}
	}

	if chunk.Status != 0 {
		response.Status = backend.Status(chunk.Status)
	}
	if chunk.Error != "" {
		response.Error = errors.New(chunk.Error)
		if chunk.Status == 0 && response.Status == backend.StatusOK {
			response.Status = backend.StatusInternal
		}
	}
	if chunk.ErrorSource != "" {
		response.ErrorSource = backend.ErrorSource(chunk.ErrorSource)
	}
	c.responses[chunk.RefId] = response
	return nil
}

func (c *chunkedQueryCollector) WriteFrame(_ context.Context, refID, frameID string, frame *data.Frame) error {
	if frame == nil {
		return errors.New("chunked query frame is nil")
	}
	include := data.IncludeAll
	if frameID != "" && c.frames[refID][frameID] != nil {
		include = data.IncludeDataOnly
	}
	encoded, err := data.FrameToJSON(frame, include)
	if err != nil {
		return err
	}
	return c.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: refID, FrameId: frameID, Frame: encoded, Format: pluginv2.DataFrameFormat_JSON, Status: 200})
}

func (c *chunkedQueryCollector) WriteError(_ context.Context, refID string, status backend.Status, err error) error {
	response := backend.ErrorResponseWithErrorSource(err)
	event := &pluginv2.QueryChunkedDataResponse{
		RefId:       refID,
		Status:      int32(status), //nolint:gosec // backend.Status contains HTTP status codes.
		ErrorSource: string(response.ErrorSource),
	}
	if err != nil {
		event.Error = err.Error()
	}
	return c.OnChunk(event)
}
