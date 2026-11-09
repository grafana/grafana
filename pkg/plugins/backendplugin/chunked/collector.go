package chunked

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// QueryResponseCollector collects JSON protobuf chunks into an ordinary response.
// A non-empty frameId identifies a logical frame within one refId, not a batch.
// Producers must reuse that ID for all batches of the same frame, with schema
// and metadata on the first batch and matching columns on continuations.
// Distinct IDs remain separate frames even when their schemas are identical.
type QueryResponseCollector struct {
	responses backend.Responses
	frames    map[string]map[string]*data.Frame
}

// Raw chunks preserve status and error source on error-only protobuf records.
var (
	_ backend.ChunkedDataWriter = (*QueryResponseCollector)(nil)
	_ RawChunkReceiver          = (*QueryResponseCollector)(nil)
)

// NewQueryResponseCollector retains an empty successful response for every query,
// including queries for which the downstream emits no events.
func NewQueryResponseCollector(refIDs ...string) *QueryResponseCollector {
	responses := backend.Responses{}
	for _, refID := range refIDs {
		responses[refID] = backend.DataResponse{Status: backend.StatusOK}
	}
	return &QueryResponseCollector{responses: responses, frames: map[string]map[string]*data.Frame{}}
}

// Response is used only after successful stream completion. Callers must discard
// collected frames if execution or decoding fails.
func (c *QueryResponseCollector) Response() *backend.QueryDataResponse {
	return &backend.QueryDataResponse{Responses: c.responses}
}

func (c *QueryResponseCollector) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
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
			if err := validateFrameData(chunk.Frame, len(previous.Fields)); err != nil {
				return err
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
			var schema struct {
				Fields []json.RawMessage `json:"fields"`
			}
			if err := json.Unmarshal(envelope.Schema, &schema); err != nil {
				return fmt.Errorf("decoding chunked query schema: %w", err)
			}
			if err := validateFrameData(chunk.Frame, len(schema.Fields)); err != nil {
				return err
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

func (c *QueryResponseCollector) WriteFrame(_ context.Context, refID, frameID string, frame *data.Frame) error {
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

func (c *QueryResponseCollector) WriteError(_ context.Context, refID string, status backend.Status, err error) error {
	source := backend.ErrorSourceFromError(err)
	event := &pluginv2.QueryChunkedDataResponse{
		RefId:       refID,
		Status:      int32(status), //nolint:gosec // backend.Status contains HTTP status codes.
		ErrorSource: string(source),
	}
	if err != nil {
		event.Error = err.Error()
	}
	return c.OnChunk(event)
}

// The SDK reader indexes fields by JSON column position and assumes equal row
// counts. Check untrusted data before it can panic or mutate retained frames.
func validateFrameData(frame json.RawMessage, fieldCount int) error {
	var payload struct {
		Data *struct {
			Values   [][]json.RawMessage `json:"values"`
			Nanos    [][]int64           `json:"nanos"`
			Entities []map[string][]int  `json:"entities"`
		} `json:"data"`
	}
	if err := json.Unmarshal(frame, &payload); err != nil {
		return fmt.Errorf("decoding chunked query frame: %w", err)
	}
	if payload.Data == nil || len(payload.Data.Values) != fieldCount {
		return errors.New("chunked query frame field count changed")
	}
	rows := 0
	if fieldCount > 0 {
		rows = len(payload.Data.Values[0])
	}
	for _, column := range payload.Data.Values {
		if len(column) != rows {
			return errors.New("chunked query frame row counts differ")
		}
	}
	if len(payload.Data.Nanos) > fieldCount || len(payload.Data.Entities) > fieldCount {
		return errors.New("chunked query frame metadata field count changed")
	}
	for _, nanos := range payload.Data.Nanos {
		if nanos != nil && len(nanos) != rows {
			return errors.New("chunked query frame nanos row count changed")
		}
	}
	for _, entities := range payload.Data.Entities {
		for _, indexes := range entities {
			for _, index := range indexes {
				if index < 0 || index >= rows {
					return errors.New("chunked query frame entity index out of range")
				}
			}
		}
	}
	return nil
}
