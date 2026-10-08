package expr

import (
	"bytes"
	"context"
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

// TransformCommand runs frontend data transformations over its inputs by calling the
// transform sidecar (scripts/transform-sidecar), which executes the same @grafana/data
// code the browser uses.
type TransformCommand struct {
	refID           string
	inputs          []string
	transformations []json.RawMessage
	timezone        string

	url     string
	timeout time.Duration
	client  *http.Client
}

type transformCommandModel struct {
	Inputs          []string          `json:"inputs"`
	Transformations []json.RawMessage `json:"transformations"`
	Timezone        string            `json:"timezone,omitempty"`
}

// UnmarshalTransformCommand creates a TransformCommand from Grafana's frontend query.
func UnmarshalTransformCommand(rn *rawNode, cfg *setting.Cfg) (*TransformCommand, error) {
	if cfg.TransformSidecarURL == "" {
		return nil, errors.New("transform expressions are disabled: [expressions] transform_sidecar_url is not set")
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

	return &TransformCommand{
		refID:           rn.RefID,
		inputs:          model.Inputs,
		transformations: model.Transformations,
		timezone:        model.Timezone,
		url:             strings.TrimSuffix(cfg.TransformSidecarURL, "/") + "/transform",
		timeout:         cfg.TransformSidecarTimeout,
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

	out, err := tc.callSidecar(ctx, transformRequest{
		Frames:          frames,
		Transformations: tc.transformations,
		Timezone:        tc.timezone,
	})
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		return mathexp.Results{}, fmt.Errorf("transform expression %s: %w", tc.refID, err)
	}

	if len(out) == 0 {
		return mathexp.Results{Values: mathexp.Values{mathexp.NewNoData()}}, nil
	}
	values := make(mathexp.Values, 0, len(out))
	for _, frame := range out {
		values = append(values, mathexp.TableData{Frame: frame})
	}
	return mathexp.Results{Values: values}, nil
}

func (tc *TransformCommand) callSidecar(ctx context.Context, body transformRequest) ([]*data.Frame, error) {
	payload, err := json.Marshal(body)
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
	req.Header.Set("Content-Type", "application/json")

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

	parsed, err := decodeTransformResponse(raw)
	if err != nil {
		return nil, fmt.Errorf("decoding transform sidecar response (status %d): %w", resp.StatusCode, err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("transform sidecar returned %d: %s", resp.StatusCode, parsed.Error)
	}
	return parsed.Frames, nil
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
