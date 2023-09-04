package expr

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

// LoadedMetricsReader is an interface that is used by HysteresisCommand to read the loaded metrics
type LoadedMetricsReader interface {
	// Read returns a hash set of fingerprints of labels that should be considered as loaded
	Read(ctx context.Context) (map[data.Fingerprint]struct{}, error)
}

// HysteresisCommand is a special case of ThresholdCommand that encapsulates two thresholds that are applied depending on the results of the previous evaluations provided via LoadedMetricsReader:
// - first threshold - "loading", is used when the metric is determined as not loaded, i.e. it does not exist in the data provided by the reader.
// - second threshold - "unloading", is used when the metric is determined as loaded.
// To determine whether a metric is loaded, the command calls LoadedMetricsReader that provides a set of data.Fingerprint of the metrics that were loaded during the previous evaluation.
// The result of the execution of the command is the same as ThresholdCommand: 0 or 1 for each metric.
type HysteresisCommand struct {
	RefID                  string
	ReferenceVar           string
	LoadingThresholdFunc   ThresholdCommand
	UnloadingThresholdFunc ThresholdCommand
	LoadedReader           LoadedMetricsReader
}

func (h *HysteresisCommand) NeedsVars() []string {
	return []string{h.ReferenceVar}
}

func (h *HysteresisCommand) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	l := logger.FromContext(ctx)
	results := vars[h.ReferenceVar]

	// shortcut for NoData
	if results.IsNoData() {
		return mathexp.Results{Values: mathexp.Values{mathexp.NewNoData()}}, nil
	}

	if h.LoadedReader == nil {
		l.Warn("Loaded metrics reader is not configured. Evaluate using loading threshold expression")
		return h.LoadingThresholdFunc.Execute(ctx, now, vars, tracer)
	}
	l.Debug("Reading loaded metrics")
	loaded, err := h.LoadedReader.Read(ctx)
	if err != nil {
		return mathexp.Results{}, err
	}
	l.Debug("Got loaded metrics", "count", logger)
	if len(loaded) == 0 || len(results.Values) == 0 {
		return h.LoadingThresholdFunc.Execute(ctx, now, vars, tracer)
	}
	var loadedVals, unloadedVals mathexp.Values

	for _, value := range results.Values {
		_, ok := loaded[value.GetLabels().Fingerprint()]
		if ok {
			loadedVals = append(loadedVals, value)
		} else {
			unloadedVals = append(unloadedVals, value)
		}
	}

	if len(loadedVals) == 0 { // if all values are unloaded
		return h.LoadingThresholdFunc.Execute(ctx, now, vars, tracer)
	}
	if len(unloadedVals) == 0 { // if all values are loaded
		return h.UnloadingThresholdFunc.Execute(ctx, now, vars, tracer)
	}

	defer func() {
		// return back the old values
		vars[h.ReferenceVar] = results
	}()

	vars[h.ReferenceVar] = mathexp.Results{Values: unloadedVals}
	loadingResults, err := h.LoadingThresholdFunc.Execute(ctx, now, vars, tracer)
	if err != nil {
		return mathexp.Results{}, fmt.Errorf("failed to execute loading threshold: %w", err)
	}
	vars[h.ReferenceVar] = mathexp.Results{Values: loadedVals}
	unloadingResults, err := h.UnloadingThresholdFunc.Execute(ctx, now, vars, tracer)
	if err != nil {
		return mathexp.Results{}, fmt.Errorf("failed to execute unloading threshold: %w", err)
	}

	return mathexp.Results{Values: append(loadingResults.Values, unloadingResults.Values...)}, nil
}

func NewHysteresisCommand(refID string, referenceVar string, loadCondition ThresholdCommand, unloadCondition ThresholdCommand, r LoadedMetricsReader) (*HysteresisCommand, error) {
	return &HysteresisCommand{
		RefID:                  refID,
		LoadingThresholdFunc:   loadCondition,
		UnloadingThresholdFunc: unloadCondition,
		ReferenceVar:           referenceVar,
		LoadedReader:           r,
	}, nil
}
