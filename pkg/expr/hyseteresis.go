package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

type LoadedMetricsReader interface {
	Read(ctx context.Context) (map[data.Fingerprint]struct{}, error)
}

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

func NewHysteresisCommand(refID string, referenceVar string, loadCondition ThresholdCommand, unloadCondition ThresholdCommand, r LoadedMetricsReader) *HysteresisCommand {
	return &HysteresisCommand{
		RefID:                  refID,
		LoadingThresholdFunc:   loadCondition,
		UnloadingThresholdFunc: unloadCondition,
		ReferenceVar:           referenceVar,
		LoadedReader:           r,
	}
}

func UnmarshalHysteresisCommand(rn *rawNode, r LoadedMetricsReader) (*HysteresisCommand, error) {
	rawQuery := rn.Query

	rawExpression, ok := rawQuery["expression"]
	if !ok {
		return nil, fmt.Errorf("no variable specified to reference for refId %v", rn.RefID)
	}
	referenceVar, ok := rawExpression.(string)
	if !ok {
		return nil, fmt.Errorf("expected threshold variable to be a string, got %T for refId %v", rawExpression, rn.RefID)
	}

	loadConditionRaw, err := json.Marshal(rawQuery["loadCondition"])
	if err != nil {
		return nil, fmt.Errorf("failed to remarshal threshold expression body: %w", err)
	}
	var loadCondition ThresholdConditionJSON
	if err = json.Unmarshal(loadConditionRaw, &loadCondition); err != nil {
		return nil, fmt.Errorf("failed to unmarshal remarshaled load condition expression body: %w", err)
	}
	if !IsSupportedThresholdFunc(loadCondition.Evaluator.Type) {
		return nil, fmt.Errorf("expected threshold function for load condition to be one of %s, got %s", strings.Join(supportedThresholdFuncs, ", "), loadCondition.Evaluator.Type)
	}

	unloadConditionRaw, err := json.Marshal(rawQuery["unloadCondition"])
	if err != nil {
		return nil, fmt.Errorf("failed to remarshal threshold expression body: %w", err)
	}
	var unloadCondition ThresholdConditionJSON
	if err = json.Unmarshal(unloadConditionRaw, &unloadCondition); err != nil {
		return nil, fmt.Errorf("failed to unmarshal remarshaled load condition expression body: %w", err)
	}
	if !IsSupportedThresholdFunc(unloadCondition.Evaluator.Type) {
		return nil, fmt.Errorf("expected threshold function for unload condition to be one of %s, got %s", strings.Join(supportedThresholdFuncs, ", "), loadCondition.Evaluator.Type)
	}

	loadThresholdCmd, err := NewThresholdCommand(rn.RefID, referenceVar, loadCondition.Evaluator.Type, loadCondition.Evaluator.Params)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize load condition command: %w", err)
	}

	unloadConditionCmd, err := NewThresholdCommand(rn.RefID, referenceVar, unloadCondition.Evaluator.Type, unloadCondition.Evaluator.Params)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize unload condition command: %w", err)
	}

	return NewHysteresisCommand(rn.RefID, referenceVar, *loadThresholdCmd, *unloadConditionCmd, r), nil
}
