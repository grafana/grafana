package expr

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

// maxTransformResponseBytes bounds how much of a sidecar response is read into memory.
const maxTransformResponseBytes = 256 << 20

// Wire formats between Grafana and the transform sidecar.
const (
	TransformWireFormatJSON  = "json"
	TransformWireFormatArrow = "arrow"

	transformArrowContentType = "application/vnd.grafana.transform+arrow"
)

// TransformCommand runs frontend data transformations over its inputs by calling the
// transform sidecar (scripts/transform-sidecar), which executes the same @grafana/data
// code the browser uses.
type TransformCommand struct {
	refID           string
	inputs          []string
	transformations []json.RawMessage
	timezone        string
	// format "alerting" returns one labeled number per row instead of table data, so the output
	// can feed threshold and math expressions in an alert rule.
	format string

	url        string
	timeout    time.Duration
	wireFormat string
	client     *http.Client
}

type transformCommandModel struct {
	Inputs          []string          `json:"inputs"`
	Transformations []json.RawMessage `json:"transformations"`
	Timezone        string            `json:"timezone,omitempty"`
	Format          string            `json:"format,omitempty"`
}

// UnmarshalTransformCommand creates a TransformCommand from Grafana's frontend query.
func UnmarshalTransformCommand(rn *rawNode, cfg *setting.Cfg) (*TransformCommand, error) {
	if cfg.TransformSidecarURL == "" {
		return nil, errors.New("transform expressions are disabled: [expressions] transform_sidecar_url is not set")
	}
	wireFormat := cfg.TransformSidecarFormat
	if wireFormat == "" {
		wireFormat = TransformWireFormatJSON
	}
	if wireFormat != TransformWireFormatJSON && wireFormat != TransformWireFormatArrow {
		return nil, fmt.Errorf("[expressions] transform_sidecar_format must be %q or %q, got %q", TransformWireFormatJSON, TransformWireFormatArrow, wireFormat)
	}

	var model transformCommandModel
	if err := json.Unmarshal(rn.QueryRaw, &model); err != nil {
		return nil, fmt.Errorf("invalid transform expression: %w", err)
	}
	if len(model.Inputs) == 0 {
		return nil, errors.New("transform expression requires at least one input in 'inputs'")
	}
	if len(model.Transformations) == 0 {
		return nil, errors.New("transform expression requires at least one entry in 'transformations'")
	}
	if model.Format != "" && model.Format != "alerting" {
		return nil, fmt.Errorf("transform expression format must be empty or 'alerting', got %q", model.Format)
	}

	return &TransformCommand{
		refID:           rn.RefID,
		inputs:          model.Inputs,
		transformations: model.Transformations,
		timezone:        model.Timezone,
		format:          model.Format,
		url:             strings.TrimSuffix(cfg.TransformSidecarURL, "/") + "/transform",
		timeout:         cfg.TransformSidecarTimeout,
		wireFormat:      wireFormat,
		client:          http.DefaultClient,
	}, nil
}

// NeedsVars returns the refIDs whose frames are sent to the sidecar, in order.
func (tc *TransformCommand) NeedsVars() []string {
	return tc.inputs
}

func (tc *TransformCommand) Type() string {
	return TypeTransform.String()
}

type transformRequest struct {
	Frames          []*data.Frame     `json:"frames"`
	Transformations []json.RawMessage `json:"transformations"`
	Timezone        string            `json:"timezone,omitempty"`
}

type transformResponse struct {
	Frames []*data.Frame `json:"frames"`
	Error  string        `json:"error"`
}

// Execute sends the input frames and transformations to the sidecar and returns each output
// frame as table data.
func (tc *TransformCommand) Execute(ctx context.Context, _ time.Time, vars mathexp.Vars, tracer tracing.Tracer, _ *metrics.ExprMetrics) (mathexp.Results, error) {
	ctx, span := tracer.Start(ctx, "SSE.ExecuteTransform")
	defer span.End()
	span.SetAttributes(
		attribute.StringSlice("inputs", tc.inputs),
		attribute.Int("transformations", len(tc.transformations)),
	)

	frames := []*data.Frame{}
	for _, refID := range tc.inputs {
		// AsDataFrames stamps each frame with its source refID, which transformations
		// such as filterByRefId and joinByField depend on.
		frames = append(frames, vars[refID].Values.AsDataFrames(refID)...)
	}

	out, err := tc.callSidecar(ctx, frames)
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		return mathexp.Results{}, fmt.Errorf("transform expression %s: %w", tc.refID, err)
	}

	values := make(mathexp.Values, 0, len(out))
	for _, frame := range out {
		if tc.format != "alerting" {
			values = append(values, mathexp.TableData{Frame: frame})
			continue
		}
		if frame.Rows() == 0 {
			continue
		}
		// Same rules as SQL expressions: one numeric field per frame, string fields become
		// labels, and label sets must be unique.
		numbers, err := extractNumberSetFromSQLForAlerting(frame)
		if err != nil {
			return mathexp.Results{}, fmt.Errorf("transform expression %s: %w", tc.refID, err)
		}
		for _, n := range numbers {
			values = append(values, n)
		}
	}

	if len(values) == 0 {
		return mathexp.Results{Values: mathexp.Values{mathexp.NewNoData()}}, nil
	}
	return mathexp.Results{Values: values}, nil
}

func (tc *TransformCommand) callSidecar(ctx context.Context, frames []*data.Frame) ([]*data.Frame, error) {
	payload, contentType, err := tc.encodeRequest(frames)
	if err != nil {
		return nil, fmt.Errorf("encoding request: %w", err)
	}

	if tc.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, tc.timeout)
		defer cancel()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tc.url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", contentType)

	resp, err := tc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling transform sidecar: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxTransformResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("reading transform sidecar response: %w", err)
	}
	if len(raw) > maxTransformResponseBytes {
		return nil, fmt.Errorf("transform sidecar response exceeds %d bytes", maxTransformResponseBytes)
	}

	if resp.StatusCode != http.StatusOK {
		var parsed transformResponse
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return nil, fmt.Errorf("transform sidecar returned %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("transform sidecar returned %d: %s", resp.StatusCode, parsed.Error)
	}

	out, err := decodeSidecarResponse(resp.Header.Get("Content-Type"), raw)
	if err != nil {
		return nil, fmt.Errorf("decoding transform sidecar response: %w", err)
	}
	return out, nil
}

// encodeRequest writes the request in the configured wire format. For Arrow, the JSON header
// carries an empty frames list and each frame follows in the Arrow IPC file format.
func (tc *TransformCommand) encodeRequest(frames []*data.Frame) ([]byte, string, error) {
	if tc.wireFormat != TransformWireFormatArrow {
		body, err := json.Marshal(transformRequest{Frames: frames, Transformations: tc.transformations, Timezone: tc.timezone})
		return body, "application/json", err
	}

	header, err := json.Marshal(transformRequest{Frames: []*data.Frame{}, Transformations: tc.transformations, Timezone: tc.timezone})
	if err != nil {
		return nil, "", err
	}
	parts := make([][]byte, 0, len(frames)+1)
	parts = append(parts, header)
	for _, frame := range frames {
		b, err := frame.MarshalArrow()
		if err != nil {
			return nil, "", err
		}
		parts = append(parts, b)
	}
	return writeArrowEnvelope(parts), transformArrowContentType, nil
}

func decodeSidecarResponse(contentType string, raw []byte) ([]*data.Frame, error) {
	if contentType != transformArrowContentType {
		parsed, err := decodeTransformResponse(raw)
		return parsed.Frames, err
	}

	parts, err := readArrowEnvelope(raw)
	if err != nil {
		return nil, err
	}
	frames := make([]*data.Frame, 0, len(parts))
	for _, part := range parts[1:] { // parts[0] is the JSON header
		frame, err := data.UnmarshalArrowFrame(part)
		if err != nil {
			return nil, err
		}
		frames = append(frames, frame)
	}
	return frames, nil
}

// The Arrow envelope is a sequence of parts, each a big-endian uint32 length followed by that many
// bytes. The first part is a JSON header; the rest are frames.
func writeArrowEnvelope(parts [][]byte) []byte {
	size := 0
	for _, p := range parts {
		size += 4 + len(p)
	}
	out := make([]byte, 0, size)
	for _, p := range parts {
		out = binary.BigEndian.AppendUint32(out, uint32(len(p))) //nolint:gosec // frames are bounded by the request size limit
		out = append(out, p...)
	}
	return out
}

func readArrowEnvelope(raw []byte) ([][]byte, error) {
	parts := [][]byte{}
	for len(raw) > 0 {
		if len(raw) < 4 {
			return nil, errors.New("truncated arrow envelope")
		}
		n := binary.BigEndian.Uint32(raw)
		raw = raw[4:]
		if uint64(len(raw)) < uint64(n) {
			return nil, errors.New("truncated arrow envelope")
		}
		parts = append(parts, raw[:n])
		raw = raw[n:]
	}
	if len(parts) == 0 {
		return nil, errors.New("empty arrow envelope")
	}
	return parts, nil
}

func decodeTransformResponse(raw []byte) (parsed transformResponse, err error) {
	// The SDK frame decoder panics, rather than returning an error, on a field without typeInfo.
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("invalid frame: %v", r)
		}
	}()
	err = json.Unmarshal(raw, &parsed)
	return parsed, err
}
