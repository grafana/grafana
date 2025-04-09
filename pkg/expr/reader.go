package expr

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Once we are comfortable with the parsing logic, this struct will
// be merged/replace the existing Query struct in grafana/pkg/expr/transform.go
type ExpressionQuery struct {
	GraphID   int64     `json:"id,omitempty"`
	RefID     string    `json:"refId"`
	QueryType QueryType `json:"type"`

	// The typed query parameters
	Properties any `json:"properties"`

	// Hidden in debug JSON
	Command Command `json:"-"`
}

// ID is used to identify nodes in the directed graph
func (q ExpressionQuery) ID() int64 {
	return q.GraphID
}

type ExpressionQueryReader struct {
	features featuremgmt.FeatureToggles
}

func NewExpressionQueryReader(features featuremgmt.FeatureToggles) *ExpressionQueryReader {
	return &ExpressionQueryReader{
		features: features,
	}
}

// nolint:gocyclo
func (h *ExpressionQueryReader) ReadQuery(
	// Properties that have been parsed off the same node
	common data.DataQuery,
	// An iterator with context for the full node (include common values)
	iter *jsoniter.Iterator,
) (eq ExpressionQuery, err error) {
	referenceVar := ""
	eq.RefID = common.RefID
	eq.QueryType = QueryType(common.GetString("type"))
	if eq.QueryType == "" {
		return eq, fmt.Errorf("missing type")
	}
	switch eq.QueryType {
	case QueryTypeMath:
		q := &MathQuery{}
		err = iter.ReadVal(q)
		if err == nil {
			eq.Command, err = NewMathCommand(common.RefID, q.Expression)
			eq.Properties = q
		}

	case QueryTypeReduce:
		var mapper mathexp.ReduceMapper = nil
		q := &ReduceQuery{}
		err = iter.ReadVal(q)
		if err == nil {
			referenceVar, err = getReferenceVar(q.Expression, common.RefID)
			eq.Properties = q
		}
		if err == nil && q.Settings != nil {
			switch q.Settings.Mode {
			case ReduceModeStrict:
				mapper = nil
			case ReduceModeDrop:
				mapper = mathexp.DropNonNumber{}
			case ReduceModeReplace:
				if q.Settings.ReplaceWithValue == nil {
					err = fmt.Errorf("setting replaceWithValue must be specified when mode is '%s'", q.Settings.Mode)
				}
				mapper = mathexp.ReplaceNonNumberWithValue{Value: *q.Settings.ReplaceWithValue}
			default:
				err = fmt.Errorf("unsupported reduce mode")
			}
		}
		if err == nil {
			eq.Properties = q
			eq.Command, err = NewReduceCommand(common.RefID,
				q.Reducer, referenceVar, mapper)
		}

	case QueryTypeResample:
		q := &ResampleQuery{}
		err = iter.ReadVal(q)
		if err == nil && common.TimeRange == nil {
			err = fmt.Errorf("missing time range in query")
		}
		if err == nil {
			referenceVar, err = getReferenceVar(q.Expression, common.RefID)
		}
		if err == nil {
			tr := gtime.NewTimeRange(common.TimeRange.From, common.TimeRange.To)
			eq.Properties = q
			eq.Command, err = NewResampleCommand(common.RefID,
				q.Window,
				referenceVar,
				q.Downsampler,
				q.Upsampler,
				AbsoluteTimeRange{
					From: tr.GetFromAsTimeUTC(),
					To:   tr.GetToAsTimeUTC(),
				},
			)
		}

	case QueryTypeClassic:
		q := &ClassicQuery{}
		err = iter.ReadVal(q)
		if err == nil {
			eq.Properties = q
			eq.Command, err = classic.NewConditionCmd(common.RefID, q.Conditions)
		}

	case QueryTypeSQL:
		if !h.features.IsEnabledGlobally(featuremgmt.FlagSqlExpressions) {
			return eq, fmt.Errorf("sql expressions are disabled")
		}
		q := &SQLExpression{}
		err = iter.ReadVal(q)
		if err == nil {
			eq.Properties = q
			// TODO: Cascade limit from Grafana config in this (new Expression Parser) branch of the code
			cellLimit := 0 // zero means no limit
			eq.Command, err = NewSQLCommand(common.RefID, q.Format, q.Expression, int64(cellLimit))
		}

	case QueryTypeThreshold:
		q := &ThresholdQuery{}
		err = iter.ReadVal(q)
		if err == nil {
			referenceVar, err = getReferenceVar(q.Expression, common.RefID)
		}
		if err == nil {
			// we only support one condition for now, we might want to turn this in to "OR" expressions later
			if len(q.Conditions) != 1 {
				return eq, fmt.Errorf("threshold expression requires exactly one condition")
			}
			firstCondition := q.Conditions[0]

			threshold, err := NewThresholdCommand(common.RefID, referenceVar, firstCondition.Evaluator.Type, firstCondition.Evaluator.Params)
			if err != nil {
				return eq, fmt.Errorf("invalid condition: %w", err)
			}
			eq.Command = threshold
			eq.Properties = q

			if firstCondition.UnloadEvaluator != nil && h.features.IsEnabledGlobally(featuremgmt.FlagRecoveryThreshold) {
				unloading, err := NewThresholdCommand(common.RefID, referenceVar, firstCondition.UnloadEvaluator.Type, firstCondition.UnloadEvaluator.Params)
				unloading.Invert = true
				if err != nil {
					return eq, fmt.Errorf("invalid unloadCondition: %w", err)
				}
				var d Fingerprints
				if firstCondition.LoadedDimensions != nil {
					d, err = FingerprintsFromFrame(firstCondition.LoadedDimensions)
					if err != nil {
						return eq, fmt.Errorf("failed to parse loaded dimensions: %w", err)
					}
				}
				eq.Command, err = NewHysteresisCommand(common.RefID, referenceVar, *threshold, *unloading, d)
				if err != nil {
					return eq, err
				}
			}
		}

	default:
		err = fmt.Errorf("unknown query type (%s)", common.QueryType)
	}
	return eq, err
}

func getReferenceVar(exp string, refId string) (string, error) {
	exp = strings.TrimPrefix(exp, "$")
	if exp == "" {
		return "", fmt.Errorf("no variable specified to reference for refId %v", refId)
	}
	return exp, nil
}
