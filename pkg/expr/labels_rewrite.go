package expr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	tmpltext "text/template"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

type labelReplace interface {
	Eval(v string) string
}

type constantReplace struct {
	Constant string
}

func (l constantReplace) Eval(v string) string {
	return l.Constant
}

type regexReplace struct {
	Regex   *regexp.Regexp
	Replace string
}

func (l regexReplace) Eval(v string) string {
	return l.Regex.ReplaceAllString(v, l.Replace)
}

type labelAdd interface {
	Eval(value mathexp.Value) (string, error)
}
type constantAdd struct {
	Constant string
}

func (l constantAdd) Eval(_ mathexp.Value) (string, error) {
	return l.Constant, nil
}

type templateAdd struct {
	Template *tmpltext.Template
}

func (t templateAdd) Eval(value mathexp.Value) (string, error) {
	var intValue int64 = math.MinInt64
	var v = math.NaN()
	number, ok := value.(mathexp.Number)
	if ok && number.GetFloat64Value() != nil {
		v = *number.GetFloat64Value()
		intValue = int64(v)
	}
	ctx := map[string]any{
		"labels":   value.GetLabels(),
		"value":    v,
		"valueInt": intValue,
	}
	var buf bytes.Buffer
	if err := t.Template.Execute(&buf, ctx); err != nil {
		return "", fmt.Errorf("expand template: %w", err)
	}
	return buf.String(), nil
}

type LabelsRewriteCommand struct {
	ReferenceVar string
	RefID        string

	Add     map[string]labelAdd
	Remove  map[string]struct{}
	Replace map[string]labelReplace
}

type labelsWithOriginalFingerprint struct {
	Value       mathexp.Value
	Fingerprint data.Fingerprint
}

func (l LabelsRewriteCommand) NeedsVars() []string {
	return []string{l.ReferenceVar}
}

func (l LabelsRewriteCommand) Execute(ctx context.Context, _ time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.LabelsRewrite")
	defer span.End()

	refVarResult := vars[l.ReferenceVar]
	newRes := mathexp.Results{Values: make(mathexp.Values, 0, len(refVarResult.Values))}
	seenLabels := make(map[data.Fingerprint]*labelsWithOriginalFingerprint)
	for _, val := range refVarResult.Values {
		var result mathexp.Value
		switch v := val.(type) {
		case mathexp.Series:
			s := mathexp.NewSeries(l.RefID, v.GetLabels(), v.Len())
			for i := 0; i < v.Len(); i++ {
				t, value := v.GetPoint(i)
				s.SetPoint(i, t, value)
			}
			result = s
		case mathexp.Number:
			copyV := mathexp.NewNumber(l.RefID, v.GetLabels())
			copyV.SetValue(v.GetFloat64Value())
			result = copyV
		case mathexp.Scalar:
			copyV := mathexp.NewScalar(l.RefID, v.GetFloat64Value())
			result = copyV
		case mathexp.NoData:
			result = mathexp.NewNoData()
		default:
			return newRes, fmt.Errorf("unsupported format of the input data, got type %v", val.Type())
		}
		if result.Type() != parse.TypeNoData {
			err := l.remapLabels(result, seenLabels)
			if err != nil {
				return mathexp.Results{}, err
			}
		}
		newRes.Values = append(newRes.Values, result)
	}
	return newRes, nil
}

func (l LabelsRewriteCommand) remapLabels(value mathexp.Value, seenLabels map[data.Fingerprint]*labelsWithOriginalFingerprint) error {
	lbls := value.GetLabels()
	result := make(data.Labels, len(lbls))
	for k, v := range lbls {
		if _, ok := l.Remove[k]; ok {
			continue
		}
		if r, ok := l.Replace[k]; ok {
			result[k] = r.Eval(v)
			continue
		}
		result[k] = v
	}
	for k, v := range l.Add {
		// do not add label if it exists.
		if _, ok := lbls[k]; ok {
			continue
		}
		val, err := v.Eval(value)
		if err != nil {
			return err
		}
		result[k] = val
	}

	fp := result.Fingerprint()
	if seen, ok := seenLabels[fp]; ok {
		result["__original_fp__"] = lbls.Fingerprint().String()
		if seen != nil { // set the dedup label to the first seen label set
			seenLbls := seen.Value.GetLabels().Copy()
			seenLbls["__original_fp__"] = seen.Fingerprint.String()
			seen.Value.SetLabels(seenLbls)
			// avoid updating many times
			seenLabels[fp] = nil
		}
	} else {
		seenLabels[fp] = &labelsWithOriginalFingerprint{
			Value:       value,
			Fingerprint: lbls.Fingerprint(), // keep fingerprint of original labels
		}
	}
	value.SetLabels(result)
	return nil
}

func (l LabelsRewriteCommand) Type() string {
	return "labels"
}

func UnmarshalLabelReplaceCommand(refID string, rawData []byte) (*LabelsRewriteCommand, error) {
	type config struct {
		Expression string `json:"expression"`
		Rewrite    struct {
			Add map[string]struct {
				Constant string `json:"constant"`
				Template string `json:"template"`
			} `json:"add"`
			Remove  []string `json:"remove"`
			Replace map[string]struct {
				Constant string `json:"constant"`
				Regex    string `json:"regex"`
				Replace  string `json:"replace"`
			} `json:"replace"`
		} `json:"labelRewrite"`
	}
	var q config
	err := json.Unmarshal(rawData, &q)
	if err != nil {
		return nil, fmt.Errorf("failed to parse the labels command: %w", err)
	}
	cfg := q.Rewrite
	if len(cfg.Add) == 0 && len(cfg.Remove) == 0 && len(cfg.Replace) == 0 {
		return nil, fmt.Errorf("no labels specified to replace")
	}
	cmd := LabelsRewriteCommand{
		RefID:        refID,
		ReferenceVar: q.Expression,
		Add:          make(map[string]labelAdd, len(cfg.Add)),
		Remove:       make(map[string]struct{}, len(cfg.Remove)),
		Replace:      make(map[string]labelReplace, len(cfg.Replace)),
	}
	for k, v := range cfg.Add {
		if v.Constant != "" && v.Template != "" {
			return nil, fmt.Errorf("cannot specify both constant and template for label %s", k)
		}
		if v.Constant != "" {
			cmd.Add[k] = constantAdd{Constant: v.Constant}
		}
		if v.Template != "" {
			t, err := tmpltext.New(k).Parse(v.Template)
			if err != nil {
				return nil, fmt.Errorf("failed to parse template for label %s: %w", k, err)
			}
			cmd.Add[k] = templateAdd{Template: t}
		}
	}
	for _, k := range cfg.Remove {
		cmd.Remove[k] = struct{}{}
	}
	for k, v := range cfg.Replace {
		if v.Constant != "" && v.Regex != "" {
			return nil, fmt.Errorf("cannot specify both constant and regex for label %s", k)
		}
		if v.Constant != "" {
			cmd.Replace[k] = constantReplace{Constant: v.Constant}
		}
		if v.Regex != "" {
			r, err := regexp.Compile(v.Regex)
			if err != nil {
				return nil, fmt.Errorf("failed to parse regex for label %s: %w", k, err)
			}
			cmd.Replace[k] = regexReplace{Regex: r, Replace: v.Replace}
		}
	}
	return &cmd, nil
}
