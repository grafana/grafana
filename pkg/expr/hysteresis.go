package expr

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

type Fingerprints map[data.Fingerprint]struct{}

// HysteresisCommand is a special case of ThresholdCommand that encapsulates two thresholds that are applied depending on the results of the previous evaluations:
// - first threshold - "loading", is used when the metric is determined as not loaded, i.e. it does not exist in the data provided by the reader.
// - second threshold - "unloading", is used when the metric is determined as loaded.
// To determine whether a metric is loaded, the command uses LoadedDimensions that is supposed to contain data.Fingerprint of
// the metrics that were loaded during the previous evaluation.
// The result of the execution of the command is the same as ThresholdCommand: 0 or 1 for each metric.
type HysteresisCommand struct {
	RefID                  string
	ReferenceVar           string
	LoadingThresholdFunc   ThresholdCommand
	UnloadingThresholdFunc ThresholdCommand
	LoadedDimensions       Fingerprints
}

func (h *HysteresisCommand) NeedsVars() []string {
	return []string{h.ReferenceVar}
}

func (h *HysteresisCommand) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer, metrics *metrics.ExprMetrics) (mathexp.Results, error) {
	results := vars[h.ReferenceVar]

	logger := logger.FromContext(ctx)
	traceCtx, span := tracer.Start(ctx, "SSE.ExecuteHysteresis")
	span.SetAttributes(attribute.Int("previousLoadedDimensions", len(h.LoadedDimensions)))
	span.SetAttributes(attribute.Int("totalDimensions", len(results.Values)))
	defer span.End()

	// shortcut for NoData
	if results.IsNoData() {
		return mathexp.Results{Values: mathexp.Values{mathexp.NewNoData()}}, nil
	}
	if len(h.LoadedDimensions) == 0 {
		return h.LoadingThresholdFunc.Execute(traceCtx, now, vars, tracer, metrics)
	}
	var loadedVals, unloadedVals mathexp.Values
	for _, value := range results.Values {
		_, ok := h.LoadedDimensions[value.GetLabels().Fingerprint()]
		if ok {
			loadedVals = append(loadedVals, value)
		} else {
			unloadedVals = append(unloadedVals, value)
		}
	}

	span.SetAttributes(attribute.Int("matchedLoadedDimensions", len(loadedVals)))

	logger.Debug("Evaluating thresholds", "unloadingThresholdDimensions", len(loadedVals), "loadingThresholdDimensions", len(unloadedVals))
	if len(loadedVals) == 0 { // if all values are unloaded
		return h.LoadingThresholdFunc.Execute(traceCtx, now, vars, tracer, metrics)
	}
	if len(unloadedVals) == 0 { // if all values are loaded
		return h.UnloadingThresholdFunc.Execute(traceCtx, now, vars, tracer, metrics)
	}

	defer func() {
		// return back the old values
		vars[h.ReferenceVar] = results
	}()

	vars[h.ReferenceVar] = mathexp.Results{Values: unloadedVals}
	loadingResults, err := h.LoadingThresholdFunc.Execute(traceCtx, now, vars, tracer, metrics)
	if err != nil {
		return mathexp.Results{}, fmt.Errorf("failed to execute loading threshold: %w", err)
	}
	vars[h.ReferenceVar] = mathexp.Results{Values: loadedVals}
	unloadingResults, err := h.UnloadingThresholdFunc.Execute(traceCtx, now, vars, tracer, metrics)
	if err != nil {
		return mathexp.Results{}, fmt.Errorf("failed to execute unloading threshold: %w", err)
	}

	return mathexp.Results{Values: append(loadingResults.Values, unloadingResults.Values...)}, nil
}

func (h HysteresisCommand) Type() string {
	return "hysteresis"
}

func NewHysteresisCommand(refID string, referenceVar string, loadCondition ThresholdCommand, unloadCondition ThresholdCommand, l Fingerprints) (*HysteresisCommand, error) {
	return &HysteresisCommand{
		RefID:                  refID,
		LoadingThresholdFunc:   loadCondition,
		UnloadingThresholdFunc: unloadCondition,
		ReferenceVar:           referenceVar,
		LoadedDimensions:       l,
	}, nil
}

// FingerprintsFromFrame converts data.Frame to Fingerprints.
// The input data frame must have a single field of uint64 type.
// Returns error if the input data frame has invalid format
func FingerprintsFromFrame(frame *data.Frame) (Fingerprints, error) {
	frameType, frameVersion := frame.TypeInfo("")
	if frameType != "fingerprints" {
		return nil, fmt.Errorf("invalid format of loaded dimensions frame: expected frame type 'fingerprints'")
	}
	if frameVersion.Greater(data.FrameTypeVersion{1, 0}) {
		return nil, fmt.Errorf("invalid format of loaded dimensions frame: expected frame type 'fingerprints' of version 1.0 or lower")
	}
	if len(frame.Fields) != 1 {
		return nil, fmt.Errorf("invalid format of loaded dimensions frame: expected a single field but got %d", len(frame.Fields))
	}
	fld := frame.Fields[0]
	if fld.Type() != data.FieldTypeUint64 {
		return nil, fmt.Errorf("invalid format of loaded dimensions frame: the field type must be uint64 but got %s", fld.Type().String())
	}
	result := make(Fingerprints, fld.Len())
	for i := 0; i < fld.Len(); i++ {
		val, ok := fld.ConcreteAt(i)
		if !ok {
			continue
		}
		switch v := val.(type) {
		case uint64:
			result[data.Fingerprint(v)] = struct{}{}
		default:
			return nil, fmt.Errorf("cannot read the value at index [%d], expected uint64 but got '%T'", i, val)
		}
	}
	return result, nil
}

// FingerprintsToFrame converts Fingerprints to data.Frame.
func FingerprintsToFrame(fingerprints Fingerprints) *data.Frame {
	fp := make([]uint64, 0, len(fingerprints))
	for fingerprint := range fingerprints {
		fp = append(fp, uint64(fingerprint))
	}
	frame := data.NewFrame("", data.NewField("fingerprints", nil, fp))
	frame.SetMeta(&data.FrameMeta{
		Type:        "fingerprints",
		TypeVersion: data.FrameTypeVersion{1, 0},
	})
	return frame
}
