package expr

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/prql"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

// Command is an interface for all expression commands.
type Command interface {
	NeedsVars() []string
	Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error)
}

// MathCommand is a command for a math expression such as "1 + $GA / 2"
type MathCommand struct {
	RawExpression string
	Expression    *mathexp.Expr
	refID         string
}

// NewMathCommand creates a new MathCommand. It will return an error
// if there is an error parsing expr.
func NewMathCommand(refID, expr string) (*MathCommand, error) {
	parsedExpr, err := mathexp.New(expr)
	if err != nil {
		return nil, err
	}
	return &MathCommand{
		RawExpression: expr,
		Expression:    parsedExpr,
		refID:         refID,
	}, nil
}

// UnmarshalMathCommand creates a MathCommand from Grafana's frontend query.
func UnmarshalMathCommand(rn *rawNode) (*MathCommand, error) {
	rawExpr, ok := rn.Query["expression"]
	if !ok {
		return nil, errors.New("command is missing an expression")
	}
	exprString, ok := rawExpr.(string)
	if !ok {
		return nil, fmt.Errorf("math expression is expected to be a string, got %T", rawExpr)
	}

	gm, err := NewMathCommand(rn.RefID, exprString)
	if err != nil {
		return nil, fmt.Errorf("invalid math command type: %w", err)
	}
	return gm, nil
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (gm *MathCommand) NeedsVars() []string {
	return gm.Expression.VarNames
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (gm *MathCommand) Execute(ctx context.Context, _ time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.ExecuteMath")
	span.SetAttributes(attribute.String("expression", gm.RawExpression))
	defer span.End()
	return gm.Expression.Execute(gm.refID, vars, tracer)
}

// ReduceCommand is an expression command for reduction of a timeseries such as a min, mean, or max.
type ReduceCommand struct {
	Reducer      string
	VarToReduce  string
	refID        string
	seriesMapper mathexp.ReduceMapper
}

// NewReduceCommand creates a new ReduceCMD.
func NewReduceCommand(refID, reducer, varToReduce string, mapper mathexp.ReduceMapper) (*ReduceCommand, error) {
	_, err := mathexp.GetReduceFunc(reducer)
	if err != nil {
		return nil, err
	}

	return &ReduceCommand{
		Reducer:      reducer,
		VarToReduce:  varToReduce,
		refID:        refID,
		seriesMapper: mapper,
	}, nil
}

// UnmarshalReduceCommand creates a MathCMD from Grafana's frontend query.
func UnmarshalReduceCommand(rn *rawNode) (*ReduceCommand, error) {
	rawVar, ok := rn.Query["expression"]
	if !ok {
		return nil, errors.New("no expression ID is specified to reduce. Must be a reference to an existing query or expression")
	}
	varToReduce, ok := rawVar.(string)
	if !ok {
		return nil, fmt.Errorf("expression ID is expected to be a string, got %T", rawVar)
	}
	varToReduce = strings.TrimPrefix(varToReduce, "$")

	rawReducer, ok := rn.Query["reducer"]
	if !ok {
		return nil, errors.New("no reducer specified")
	}
	redFunc, ok := rawReducer.(string)
	if !ok {
		return nil, fmt.Errorf("expected reducer to be a string, got %T", rawReducer)
	}

	var mapper mathexp.ReduceMapper = nil
	settings, ok := rn.Query["settings"]
	if ok {
		switch s := settings.(type) {
		case map[string]any:
			mode, ok := s["mode"]
			if ok && mode != "" {
				switch mode {
				case "dropNN":
					mapper = mathexp.DropNonNumber{}
				case "replaceNN":
					valueStr, ok := s["replaceWithValue"]
					if !ok {
						return nil, errors.New("setting replaceWithValue must be specified when mode is 'replaceNN'")
					}
					switch value := valueStr.(type) {
					case float64:
						mapper = mathexp.ReplaceNonNumberWithValue{Value: value}
					default:
						return nil, fmt.Errorf("setting replaceWithValue must be a number, got %T", value)
					}
				default:
					return nil, fmt.Errorf("reducer mode '%s' is not supported. Supported only: [dropNN,replaceNN]", mode)
				}
			}
		default:
			return nil, fmt.Errorf("field settings must be an object, got %T for refId %v", s, rn.RefID)
		}
	}
	return NewReduceCommand(rn.RefID, redFunc, varToReduce, mapper)
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (gr *ReduceCommand) NeedsVars() []string {
	return []string{gr.VarToReduce}
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (gr *ReduceCommand) Execute(ctx context.Context, _ time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.ExecuteReduce")
	defer span.End()

	span.SetAttributes(attribute.String("reducer", gr.Reducer))

	newRes := mathexp.Results{}
	for i, val := range vars[gr.VarToReduce].Values {
		switch v := val.(type) {
		case mathexp.Series:
			num, err := v.Reduce(gr.refID, gr.Reducer, gr.seriesMapper)
			if err != nil {
				return newRes, err
			}
			newRes.Values = append(newRes.Values, num)
		case mathexp.Number: // if incoming vars is just a number, any reduce op is just a noop, add it as it is
			value := v.GetFloat64Value()
			if gr.seriesMapper != nil {
				value = gr.seriesMapper.MapInput(value)
				if value == nil { // same logic as in mapSeries
					continue
				}
			}
			copyV := mathexp.NewNumber(gr.refID, v.GetLabels())
			copyV.SetValue(value)
			if gr.seriesMapper == nil && i == 0 { // Add notice to only the first result to not multiple them in presentation
				copyV.AddNotice(data.Notice{
					Severity: data.NoticeSeverityWarning,
					Text:     fmt.Sprintf("Reduce operation is not needed. Input query or expression %s is already reduced data.", gr.VarToReduce),
				})
			}
			newRes.Values = append(newRes.Values, copyV)
		case mathexp.NoData:
			newRes.Values = append(newRes.Values, v.New())
		default:
			return newRes, fmt.Errorf("can only reduce type series, got type %v", val.Type())
		}
	}
	return newRes, nil
}

// ResampleCommand is an expression command for resampling of a timeseries.
type ResampleCommand struct {
	Window        time.Duration
	VarToResample string
	Downsampler   string
	Upsampler     string
	TimeRange     TimeRange
	refID         string
}

// NewResampleCommand creates a new ResampleCMD.
func NewResampleCommand(refID, rawWindow, varToResample string, downsampler string, upsampler string, tr TimeRange) (*ResampleCommand, error) {
	// TODO: validate reducer here, before execution
	window, err := gtime.ParseDuration(rawWindow)
	if err != nil {
		return nil, fmt.Errorf(`failed to parse resample "window" duration field %q: %w`, window, err)
	}
	return &ResampleCommand{
		Window:        window,
		VarToResample: varToResample,
		Downsampler:   downsampler,
		Upsampler:     upsampler,
		TimeRange:     tr,
		refID:         refID,
	}, nil
}

// UnmarshalResampleCommand creates a ResampleCMD from Grafana's frontend query.
func UnmarshalResampleCommand(rn *rawNode) (*ResampleCommand, error) {
	if rn.TimeRange == nil {
		return nil, fmt.Errorf("time range must be specified for refID %s", rn.RefID)
	}
	rawVar, ok := rn.Query["expression"]
	if !ok {
		return nil, errors.New("no expression ID to resample. must be a reference to an existing query or expression")
	}
	varToReduce, ok := rawVar.(string)
	if !ok {
		return nil, fmt.Errorf("expected resample input variable to be type string, but got type %T", rawVar)
	}
	varToReduce = strings.TrimPrefix(varToReduce, "$")
	varToResample := varToReduce

	rawWindow, ok := rn.Query["window"]
	if !ok {
		return nil, errors.New("no time duration specified for the window in resample command")
	}
	window, ok := rawWindow.(string)
	if !ok {
		return nil, fmt.Errorf("resample window is expected to be a string, got %T", rawWindow)
	}

	rawDownsampler, ok := rn.Query["downsampler"]
	if !ok {
		return nil, errors.New("no downsampler function specified in resample command")
	}
	downsampler, ok := rawDownsampler.(string)
	if !ok {
		return nil, fmt.Errorf("expected resample downsampler to be a string, got type %T", downsampler)
	}

	rawUpsampler, ok := rn.Query["upsampler"]
	if !ok {
		return nil, errors.New("no upsampler specified in resample command")
	}
	upsampler, ok := rawUpsampler.(string)
	if !ok {
		return nil, fmt.Errorf("expected resample downsampler to be a string, got type %T", upsampler)
	}

	return NewResampleCommand(rn.RefID, window, varToResample, downsampler, upsampler, rn.TimeRange)
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (gr *ResampleCommand) NeedsVars() []string {
	return []string{gr.VarToResample}
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (gr *ResampleCommand) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.ExecuteResample")
	defer span.End()
	newRes := mathexp.Results{}
	timeRange := gr.TimeRange.AbsoluteTime(now)
	for _, val := range vars[gr.VarToResample].Values {
		if val == nil {
			continue
		}
		switch v := val.(type) {
		case mathexp.Series:
			num, err := v.Resample(gr.refID, gr.Window, gr.Downsampler, gr.Upsampler, timeRange.From, timeRange.To)
			if err != nil {
				return newRes, err
			}
			newRes.Values = append(newRes.Values, num)
		case mathexp.NoData:
			newRes.Values = append(newRes.Values, v.New())
			return newRes, nil
		default:
			return newRes, fmt.Errorf("can only resample type series, got type %v", val.Type())
		}
	}
	return newRes, nil
}

// PRQLCommand is an expression to run PRQL over results
type PRQLCommand struct {
	RawQuery   string
	VarToQuery string
	TimeRange  TimeRange
	refID      string // The output refid?
}

// NewPRQLCommand creates a new PRQLCMD.
func NewPRQLCommand(refID, varToQuery, rawQuery string, tr TimeRange) (*PRQLCommand, error) {
	return &PRQLCommand{
		RawQuery:   rawQuery,
		VarToQuery: varToQuery,
		TimeRange:  tr,
		refID:      refID,
	}, nil
}

// UnmarshalPRQLCommand creates a PRQLCMD from Grafana's frontend query.
func UnmarshalPRQLCommand(rn *rawNode) (*PRQLCommand, error) {
	if rn.TimeRange == nil {
		return nil, fmt.Errorf("time range must be specified for refID %s", rn.RefID)
	}

	// TODO: replace with the refIds from SELECT and JOIN
	rawVar, ok := rn.Query["expression"]
	if !ok {
		return nil, errors.New("no expression ID to resample. must be a reference to an existing query or expression")
	}
	varToQuery, ok := rawVar.(string)
	if !ok {
		return nil, fmt.Errorf("expected prql input variable to be type string, but got type %T", rawVar)
	}
	varToQuery = strings.TrimPrefix(varToQuery, "$")

	prqlQuerySettingsAny, ok := rn.Query["prql"] //
	if !ok {
		return nil, errors.New("no prql query specified")
	}
	prqlQuerySettings, ok := prqlQuerySettingsAny.(map[string]any)
	if !ok {
		return nil, errors.New("no prql node in query options")
	}
	rawQuery, ok := prqlQuerySettings["rawQuery"].(string)
	fmt.Printf("QUERY (%s): %+v\n", rawQuery, rn.Query)
	if !ok {
		return nil, fmt.Errorf("expected THE PRQL input to be type string, but got type %T", rawQuery)
	}

	sql, err := prql.Convert(rawQuery, "")
	if err != nil {
		return nil, err
	}

	tables, err := prql.Tables(sql)
	if err != nil {
		return nil, err
	}

	vars := strings.Join(tables, ",")

	return NewPRQLCommand(rn.RefID, vars, rawQuery, rn.TimeRange)
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (gr *PRQLCommand) NeedsVars() []string {
	return strings.Split(gr.VarToQuery, ",")
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (gr *PRQLCommand) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.ExecutePRQL")
	defer span.End()

	// insert all referenced results into duckdb. TODO: multi-thread this?
	refs := strings.Split(gr.VarToQuery, ",")
	for _, ref := range refs {
		results := vars[ref]
		frames := results.Values.AsDataFrames(ref)
		duckdb := prql.DuckDB{Name: "db"}
		err := duckdb.AppendAll(ctx, frames)
		if err != nil {
			return mathexp.Results{}, err
		}
	}

	frames, err := prql.Query("db", gr.RawQuery)
	if err != nil {
		return mathexp.Results{}, err
	}

	var values mathexp.Values
	for _, f := range frames {
		v := mathexp.Scalar{Frame: f}
		values = append(values, v)
	}

	// df := data.NewFrame("TODO")
	// v := mathexp.Scalar{Frame: df} // ??? what type?

	return mathexp.Results{
		Values: values,
	}, nil
}

// CommandType is the type of the expression command.
type CommandType int

const (
	// TypeUnknown is the CMDType for an unrecognized expression type.
	TypeUnknown CommandType = iota
	// TypeMath is the CMDType for a math expression.
	TypeMath
	// TypeReduce is the CMDType for a reduction expression.
	TypeReduce
	// TypeResample is the CMDType for a resampling expression.
	TypeResample
	// TypePRQL is the CMDType for evaluating PRQL
	TypePRQL
	// TypeClassicConditions is the CMDType for the classic condition operation.
	TypeClassicConditions
	// TypeThreshold is the CMDType for checking if a threshold has been crossed
	TypeThreshold
)

func (gt CommandType) String() string {
	switch gt {
	case TypeMath:
		return "math"
	case TypeReduce:
		return "reduce"
	case TypeResample:
		return "resample"
	case TypePRQL:
		return "prql"
	case TypeClassicConditions:
		return "classic_conditions"
	default:
		return "unknown"
	}
}

// ParseCommandType returns a CommandType from its string representation.
func ParseCommandType(s string) (CommandType, error) {
	switch s {
	case "math":
		return TypeMath, nil
	case "reduce":
		return TypeReduce, nil
	case "resample":
		return TypeResample, nil
	case "prql":
		return TypePRQL, nil
	case "classic_conditions":
		return TypeClassicConditions, nil
	case "threshold":
		return TypeThreshold, nil
	default:
		return TypeUnknown, fmt.Errorf("'%v' is not a recognized expression type", s)
	}
}
