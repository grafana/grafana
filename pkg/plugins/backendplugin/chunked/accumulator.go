package chunked

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AccumulateJSONLines reads the existing JSONL protocol into the shared collector.
// EOF ends this protocol; an HTTP Status error may follow already emitted frames.
func AccumulateJSONLines(reader io.Reader, refIDs ...string) (*backend.QueryDataResponse, error) {
	collector := NewQueryResponseCollector(refIDs...)
	decoder := json.NewDecoder(reader)
	for {
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			if errors.Is(err, io.EOF) {
				return collector.Response(), nil
			}
			return nil, fmt.Errorf("reading chunked datasource response: %w", err)
		}
		var header struct {
			Kind   string          `json:"kind"`
			RefID  string          `json:"refId"`
			Status json.RawMessage `json:"status"`
		}
		if err := json.Unmarshal(raw, &header); err != nil {
			return nil, err
		}
		// TypeMeta is optional when a Kubernetes Status is encoded directly.
		// Recognize its string-valued failure status before decoding the numeric
		// status of a query record, while keeping records with a refId separate.
		if header.Kind == "Status" || (header.Kind == "" && header.RefID == "" && string(header.Status) == `"Failure"`) {
			var status metav1.Status
			if err := json.Unmarshal(raw, &status); err != nil {
				return nil, err
			}
			if status.Status != metav1.StatusFailure {
				return nil, errors.New("unexpected non-failure Status in chunked response")
			}
			return nil, &apierrors.StatusError{ErrStatus: status}
		}
		var event *struct {
			RefID       string          `json:"refId"`
			FrameID     string          `json:"frameId"`
			Frame       json.RawMessage `json:"frame"`
			Status      int32           `json:"status"`
			Error       string          `json:"error"`
			ErrorSource string          `json:"errorSource"`
		}
		if err := json.Unmarshal(raw, &event); err != nil {
			return nil, err
		}
		if event == nil {
			return nil, errors.New("chunked datasource response is missing refId")
		}
		if err := collector.OnChunk(&pluginv2.QueryChunkedDataResponse{
			RefId: event.RefID, FrameId: event.FrameID, Frame: event.Frame, Format: pluginv2.DataFrameFormat_JSON,
			Status: event.Status, Error: event.Error, ErrorSource: event.ErrorSource,
		}); err != nil {
			return nil, err
		}
	}
}
