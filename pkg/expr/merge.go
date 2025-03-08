package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

type ConflictResolution string

var (
	DropValue ConflictResolution = "drop"
)

type MergeCommand struct {
	ReferenceVar       []string
	RefID              string
	ConflictResolution ConflictResolution
}

func (l MergeCommand) NeedsVars() []string {
	return l.ReferenceVar
}

type valuesAndRefIDs struct {
	Values []mathexp.Value
	RefID  string
}

func (l MergeCommand) Execute(ctx context.Context, _ time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.Merge")
	defer span.End()

	length := 0
	var expectedType = parse.TypeNoData
	for _, s := range l.ReferenceVar {
		length += len(vars[s].Values)
		if len(vars[s].Values) > 0 {
			t := vars[s].Values[0].Type()
			if t == parse.TypeNoData {
				continue
			}
			if expectedType == parse.TypeNoData {
				expectedType = t
			} else if t != expectedType {
				return mathexp.Results{}, fmt.Errorf("format of refID %s %s is different than %s. make sure all input references have the same format", s, t, expectedType)
			}
		}
	}

	if expectedType == parse.TypeNoData {
		return mathexp.Results{Values: mathexp.Values{mathexp.NewNoData()}}, nil
	}
	if expectedType != parse.TypeSeriesSet && expectedType != parse.TypeNumberSet {
		return mathexp.Results{}, fmt.Errorf("unsupported format of the input data, got type %v", expectedType)
	}

	newRes := mathexp.Results{Values: make(mathexp.Values, 0, length)}
	seenLabels := make(map[data.Fingerprint]valuesAndRefIDs, length)
	dropped := 0
	for _, s := range l.ReferenceVar {
		refVarResult := vars[s]
		for _, val := range refVarResult.Values {
			// ignore no data values
			if val.Type() == parse.TypeNoData {
				continue
			}
			if expectedType != val.Type() {
				return mathexp.Results{}, fmt.Errorf("format of refID %s %s is different than %s. make sure all input references have the same format", s, val.Type(), expectedType)
			}
			switch val.(type) {
			case mathexp.Series:
			case mathexp.Number:
			default:
				return newRes, fmt.Errorf("unsupported format of the input data, got type %v", val.Type())
			}
			fp := val.GetLabels().Fingerprint()
			if seen, ok := seenLabels[fp]; ok && seen.RefID != l.RefID {
				// TODO add notice to mention dropped
				if l.ConflictResolution == DropValue {
					dropped++
					continue
				}
			}
			seenLabels[fp] = valuesAndRefIDs{
				Values: nil,
				RefID:  s,
			}
			newRes.Values = append(newRes.Values, val)
		}
	}
	return newRes, nil
}

func (l MergeCommand) Type() string {
	return "merge"
}

func UnmarshalMergeCommand(refID string, rawData []byte) (*MergeCommand, error) {
	type config struct {
		Merge struct {
			RefIDs     []string `json:"refIds"`
			Resolution string   `json:"resolution"`
		} `json:"merge"`
	}
	var q config
	err := json.Unmarshal(rawData, &q)
	if err != nil {
		return nil, fmt.Errorf("failed to parse the merge command: %w", err)
	}
	cfg := q.Merge
	if len(cfg.RefIDs) == 0 {
		return nil, fmt.Errorf("no ref ids specified to merge")
	}
	refs := make(map[string]struct{}, len(cfg.RefIDs))
	cmd := MergeCommand{
		RefID:              refID,
		ReferenceVar:       make([]string, 0, len(cfg.RefIDs)),
		ConflictResolution: ConflictResolution(strings.ToLower(cfg.Resolution)),
	}

	for _, refID := range cfg.RefIDs {
		if _, ok := refs[refID]; ok {
			return nil, fmt.Errorf("duplicate refID %s", refID)
		}
		refs[refID] = struct{}{}
		cmd.ReferenceVar = append(cmd.ReferenceVar, refID)
	}

	if cmd.ConflictResolution != DropValue {
		return nil, fmt.Errorf("unsupported conflict resolution %s", cmd.ConflictResolution)
	}
	return &cmd, nil
}
