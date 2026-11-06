package chunked

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// ReadJSONLines forwards events as they arrive and requires explicit completion.
// EOF between complete frame events is insufficient evidence of success.
func ReadJSONLines(reader io.Reader, receiver RawChunkReceiver) error {
	decoder := json.NewDecoder(reader)
	complete := false
	for {
		var event *Event
		if err := decoder.Decode(&event); err != nil {
			if errors.Is(err, io.EOF) {
				if complete {
					return nil
				}
				return fmt.Errorf("chunked query response ended without a completion record: %w", io.ErrUnexpectedEOF)
			}
			return fmt.Errorf("reading chunked query response: %w", err)
		}
		if complete {
			return fmt.Errorf("chunked query response contains data after completion")
		}
		if event == nil {
			return fmt.Errorf("invalid null chunked query event")
		}
		switch event.Type {
		case "complete":
			if event.RefID != "" || event.Frame != nil || event.Error != "" || event.FrameID != "" || event.Status != 0 || event.ErrorSource != "" {
				return fmt.Errorf("invalid chunked query completion record")
			}
			complete = true
		case "error":
			if event.Error == "" {
				return fmt.Errorf("chunked query stream error is missing its message")
			}
			return fmt.Errorf("chunked query stream failed: %s", event.Error)
		case "":
			if event.RefID == "" {
				return fmt.Errorf("chunked query event is missing refId")
			}
			if err := receiver.OnChunk(&pluginv2.QueryChunkedDataResponse{
				RefId: event.RefID, FrameId: event.FrameID, Frame: event.Frame,
				Format: pluginv2.DataFrameFormat_JSON, Status: event.Status,
				Error: event.Error, ErrorSource: event.ErrorSource,
			}); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported chunked query event type: %s", event.Type)
		}
	}
}

type responseCollector struct {
	responses    backend.Responses
	frameIndexes map[string]map[string]int
}

func (c *responseCollector) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	response, exists := c.responses[chunk.RefId]
	if !exists {
		response.Status = backend.StatusOK
	}
	if len(chunk.Frame) > 0 {
		if c.frameIndexes[chunk.RefId] == nil {
			c.frameIndexes[chunk.RefId] = map[string]int{}
		}
		index, found := c.frameIndexes[chunk.RefId][chunk.FrameId]
		if chunk.FrameId != "" && found {
			if err := data.AppendJSONData(response.Frames[index], chunk.Frame); err != nil {
				return fmt.Errorf("appending chunked query data: %w", err)
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
				return fmt.Errorf("first chunked query frame requires schema and data")
			}
			var frame data.Frame
			if err := json.Unmarshal(chunk.Frame, &frame); err != nil {
				return fmt.Errorf("decoding chunked query frame: %w", err)
			}
			if frame.RefID == "" {
				frame.RefID = chunk.RefId
			}
			if chunk.FrameId != "" {
				c.frameIndexes[chunk.RefId][chunk.FrameId] = len(response.Frames)
			}
			response.Frames = append(response.Frames, &frame)
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

// AccumulateJSONLines buffers a completed stream into the ordinary query response.
// A stream failure discards the collected response rather than returning partial success.
func AccumulateJSONLines(reader io.Reader) (*backend.QueryDataResponse, error) {
	collector := &responseCollector{responses: backend.Responses{}, frameIndexes: map[string]map[string]int{}}
	if err := ReadJSONLines(reader, collector); err != nil {
		return nil, err
	}
	return &backend.QueryDataResponse{Responses: collector.responses}, nil
}
