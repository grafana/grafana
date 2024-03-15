package expr

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/scottlepp/go-duck/duck"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/sql"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// SQLCommand is an expression to run SQL over results
type SQLCommand struct {
	query       string
	varsToQuery []string
	refID       string
}

// NewSQLCommand creates a new SQLCommand.
func NewSQLCommand(refID, rawSQL string) (*SQLCommand, error) {
	if rawSQL == "" {
		return nil, errutil.BadRequest("sql-missing-query",
			errutil.WithPublicMessage("missing SQL query"))
	}
	tables, err := sql.TablesList(rawSQL)
	if err != nil {
		logger.Warn("invalid sql query", "sql", rawSQL, "error", err)
		return nil, errutil.BadRequest("sql-invalid-sql",
			errutil.WithPublicMessage("error reading SQL command"),
		)
	}
	return &SQLCommand{
		query:       rawSQL,
		varsToQuery: tables,
		refID:       refID,
	}, nil
}

// UnmarshalSQLCommand creates a SQLCommand from Grafana's frontend query.
func UnmarshalSQLCommand(rn *rawNode) (*SQLCommand, error) {
	if rn.TimeRange == nil {
		return nil, fmt.Errorf("time range must be specified for refID %s", rn.RefID)
	}

	expressionRaw, ok := rn.Query["expression"]
	if !ok {
		return nil, errors.New("no expression in the query")
	}
	expression, ok := expressionRaw.(string)
	if !ok {
		return nil, fmt.Errorf("expected sql expression to be type string, but got type %T", expressionRaw)
	}

	return NewSQLCommand(rn.RefID, expression)
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (gr *SQLCommand) NeedsVars() []string {
	return gr.varsToQuery
}

// Execute runs the command and returns the results or an error if the command
// failed to execute.
func (gr *SQLCommand) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.ExecuteSQL")
	defer span.End()

	allFrames := []*data.Frame{}
	for _, ref := range gr.varsToQuery {
		results := vars[ref]
		frames := results.Values.AsDataFrames(ref)
		allFrames = append(allFrames, frames...)
	}

	rsp := mathexp.Results{}

	duckDB := duck.NewInMemoryDB()
	var frame = &data.Frame{}
	err := duckDB.QueryFramesInto(gr.refID, gr.query, allFrames, frame)
	if err != nil {
		rsp.Error = err
		return rsp, nil
	}

	frame.RefID = gr.refID

	if frame.Rows() == 0 {
		rsp.Values = mathexp.Values{
			mathexp.NoData{Frame: frame},
		}
	}

	rsp.Values = mathexp.Values{
		mathexp.TableData{Frame: frame},
	}

	return rsp, nil
}
