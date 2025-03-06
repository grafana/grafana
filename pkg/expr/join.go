package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"maps"
	"math"
	"time"
	"unsafe"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util"
)

type joinType string

const (
	joinTypeInner joinType = "inner"
	joinTypeLeft  joinType = "outer"
)

type JoinCommand struct {
	RefID          string
	LeftVar        string
	RightVar       string
	MathExpression *mathexp.Expr
	JoinType       joinType
	Labels         []string
}

func (cmd JoinCommand) NeedsVars() []string {
	return []string{cmd.LeftVar, cmd.RightVar}
}

func (cmd JoinCommand) Execute(ctx context.Context, _ time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	left := vars[cmd.LeftVar]
	right := vars[cmd.RightVar]
	err := checkTypeCompatibility(left, right)
	if err != nil {
		return mathexp.Results{}, err
	}
	_, span := tracer.Start(ctx, "SSE.Join")
	span.SetAttributes(attribute.KeyValue{Key: "joinType", Value: attribute.StringValue(string(cmd.JoinType))})
	span.SetAttributes(attribute.KeyValue{Key: "leftType", Value: attribute.StringValue(left.Values[0].Type().String())})
	span.SetAttributes(attribute.KeyValue{Key: "rightType", Value: attribute.StringValue(right.Values[0].Type().String())})
	defer span.End()

	return cmd.join(left, right)
}

func (cmd JoinCommand) Type() string {
	return "join"
}

func (cmd JoinCommand) join(left, right mathexp.Results) (mathexp.Results, error) {
	index := make(map[data.Fingerprint][]mathexp.Value, len(left.Values))
	for i := 0; i < len(right.Values); i++ {
		v := right.Values[i]
		fp, good := fingerprint(v.GetLabels(), cmd.Labels)
		if !good {
			// Always drop the right part.
			continue
		}
		index[fp] = append(index[fp], v)
	}
	result := mathexp.Results{Values: make(mathexp.Values, 0, len(left.Values))}
	for i := 0; i < len(left.Values); i++ {
		fp, good := fingerprint(left.Values[i].GetLabels(), cmd.Labels)
		if good {
			if values, ok := index[fp]; ok {
				for _, r := range values {
					res, err := cmd.evalMath(left.Values[i], r)
					if err != nil {
						return mathexp.Results{}, err
					}
					result.Values = append(result.Values, res)
				}
				continue
			}
		}
		// if left side either does not have all labels or no match from right side
		// then evaluate it with nil right side
		if cmd.JoinType == joinTypeLeft {
			r, err := cmd.evalMath(left.Values[i], mathexp.NewScalar("", util.Pointer(math.NaN())))
			if err != nil {
				return mathexp.Results{}, err
			}
			result.Values = append(result.Values, r)
		}
	}
	return result, nil
}

func (cmd JoinCommand) evalMath(left, right mathexp.Value) (mathexp.Value, error) {
	l, err := getScalar(left)
	if err != nil {
		return nil, fmt.Errorf("invalid left side of join: %w", err)
	}
	r, err := getScalar(right)
	if err != nil {
		return nil, fmt.Errorf("invalid right side of join: %w", err)
	}

	result, err := cmd.MathExpression.Execute(cmd.RefID, mathexp.Vars{
		cmd.LeftVar:  mathexp.Results{Values: []mathexp.Value{l}},
		cmd.RightVar: mathexp.Results{Values: []mathexp.Value{r}},
	}, nil)
	if err != nil {
		return nil, err
	}
	if result.IsNoData() {
		// TODO ? add NAN or nil?
		return nil, fmt.Errorf("math expression returned no data")
	}
	if len(result.Values) == 0 {
		return nil, fmt.Errorf("math expression returned no results")
	}
	if len(result.Values) > 1 {
		return nil, fmt.Errorf("math expression returned more than one result")
	}
	s, ok := result.Values[0].(mathexp.Scalar)
	if !ok {
		return nil, fmt.Errorf("math expression returned non-scalar result")
	}
	lbs := cmd.joinLabels(left.GetLabels(), right.GetLabels())
	n := mathexp.NewNumber(cmd.RefID, lbs)
	n.SetValue(s.GetFloat64Value())
	return n, nil
}

func (cmd JoinCommand) joinLabels(left, right data.Labels) data.Labels {
	if right == nil {
		return left
	}
	if left == nil {
		return right
	}
	result := make(data.Labels, len(left)+len(right)-len(cmd.Labels))
	maps.Copy(result, left)
	for k, v := range right {
		if _, ok := result[k]; ok {
			continue
		}
		result[k] = v
	}
	return result
}

func getScalar(v mathexp.Value) (mathexp.Scalar, error) {
	switch expr := v.(type) {
	case mathexp.Number:
		return mathexp.NewScalar(expr.Frame.Name, expr.GetFloat64Value()), nil
	case mathexp.Scalar:
		return expr, nil
	default:
		return mathexp.Scalar{}, fmt.Errorf("unsupported type %s, must be either scalar or number", v.Type())
	}
}

func checkTypeCompatibility(left, right mathexp.Results) error {
	if !left.IsNoData() {
		if left.Values[0].Type() != parse.TypeNumberSet {
			return fmt.Errorf("left side of join must be a number set, but got %s", left.Values[0].Type())
		}
	}
	if !right.IsNoData() {
		if right.Values[0].Type() != parse.TypeNumberSet {
			return fmt.Errorf("right side of join must be a number set, but got %s", left.Values[0].Type())
		}
	}
	return nil
}

// fingerprint generates a fingerprint for a given set of labels and subset keys, ensuring all subset keys exist in the labels.
// Returns the computed fingerprint and a boolean indicating success or failure based on subset existence in the labels.
func fingerprint(lbls data.Labels, subset []string) (data.Fingerprint, bool) {
	if len(lbls) < len(subset) {
		return 0, false
	}
	h := fnv.New64()
	for _, key := range subset {
		value, ok := lbls[key]
		if !ok {
			return 0, false
		}
		// avoid an extra allocation of a slice of bytes using unsafe conversions.
		// The internal structure of the string is almost like a slice (except capacity).
		_, _ = h.Write(unsafe.Slice(unsafe.StringData(key), len(key))) //nolint:gosec
		// ignore errors returned by Write method because fnv never returns them.
		_, _ = h.Write([]byte{255})                                        // use an invalid utf-8 sequence as separator
		_, _ = h.Write(unsafe.Slice(unsafe.StringData(value), len(value))) //nolint:gosec
		_, _ = h.Write([]byte{255})
	}
	return data.Fingerprint(h.Sum64()), true
}

func UnmarshalJoinCommand(refID string, rawData []byte) (*JoinCommand, error) {
	type config struct {
		Join struct {
			LeftRefId      string   `json:"leftRefId"`
			RightRefId     string   `json:"rightRefId"`
			JoinType       string   `json:"joinType"`
			Labels         []string `json:"labels"`
			MathExpression string   `json:"expression"`
		} `json:"join"`
	}

	var q config
	err := json.Unmarshal(rawData, &q)
	if err != nil {
		return nil, fmt.Errorf("failed to parse the merge command: %w", err)
	}
	cfg := q.Join
	if cfg.LeftRefId == "" {
		return nil, fmt.Errorf("no left ref id specified to join")
	}
	if cfg.RightRefId == "" {
		return nil, fmt.Errorf("no right ref id specified to join")
	}
	if cfg.JoinType != string(joinTypeInner) && cfg.JoinType != string(joinTypeLeft) {
		return nil, fmt.Errorf("unsupported join type %s", cfg.JoinType)
	}
	if len(cfg.Labels) == 0 {
		return nil, fmt.Errorf("no labels specified to join")
	}
	if cfg.MathExpression == "" {
		return nil, fmt.Errorf("no math expression specified to join")
	}
	parsedExpr, err := mathexp.New(cfg.MathExpression)
	if err != nil {
		return nil, fmt.Errorf("failed to parse math expression: %w", err)
	}

	return &JoinCommand{
		RefID:          refID,
		LeftVar:        cfg.LeftRefId,
		RightVar:       cfg.RightRefId,
		MathExpression: parsedExpr,
		JoinType:       joinType(cfg.JoinType),
		Labels:         cfg.Labels,
	}, nil
}
