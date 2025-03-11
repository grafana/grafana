package expr

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/sql"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

// SQLCommand is an expression to run SQL over results
type SQLCommand struct {
	query       string
	varsToQuery []string
	refID       string
	limit       int64
}

// NewSQLCommand creates a new SQLCommand.
func NewSQLCommand(refID, rawSQL string, limit int64) (*SQLCommand, error) {
	if rawSQL == "" {
		return nil, errutil.BadRequest("sql-missing-query",
			errutil.WithPublicMessage("missing SQL query"))
	}
	tables, err := sql.TablesList(rawSQL)
	if err != nil {
		logger.Warn("invalid sql query", "sql", rawSQL, "error", err)
		return nil, errutil.BadRequest("sql-invalid-sql",
			errutil.WithPublicMessage(fmt.Sprintf("invalid SQL query: %s", err)),
		)
	}
	if len(tables) == 0 {
		logger.Warn("no tables found in SQL query", "sql", rawSQL)
	}
	if tables != nil {
		logger.Debug("REF tables", "tables", tables, "sql", rawSQL)
	}

	return &SQLCommand{
		query:       rawSQL,
		varsToQuery: tables,
		refID:       refID,
		limit:       limit,
	}, nil
}

// UnmarshalSQLCommand creates a SQLCommand from Grafana's frontend query.
func UnmarshalSQLCommand(rn *rawNode, limit int64) (*SQLCommand, error) {
	if rn.TimeRange == nil {
		logger.Error("time range must be specified for refID", "refID", rn.RefID)
		return nil, fmt.Errorf("time range must be specified for refID %s", rn.RefID)
	}

	expressionRaw, ok := rn.Query["expression"]
	if !ok {
		logger.Error("no expression in the query", "query", rn.Query)
		return nil, errors.New("no expression in the query")
	}
	expression, ok := expressionRaw.(string)
	if !ok {
		logger.Error("expected sql expression to be type string", "expression", expressionRaw)
		return nil, fmt.Errorf("expected sql expression to be type string, but got type %T", expressionRaw)
	}

	return NewSQLCommand(rn.RefID, expression, limit)
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
		results, ok := vars[ref]
		if !ok {
			logger.Warn("no results found for", "ref", ref)
			continue
		}
		frames := results.Values.AsDataFrames(ref)
		allFrames = append(allFrames, frames...)
	}

	totalCells := totalCells(allFrames)
	// limit of 0 or less means no limit (following convention)
	if gr.limit > 0 && totalCells > gr.limit {
		return mathexp.Results{},
			fmt.Errorf(
				"SQL expression: total cell count across all input tables exceeds limit of %d. Total cells: %d",
				gr.limit,
				totalCells,
			)
	}

	logger.Debug("Executing query", "query", gr.query, "frames", len(allFrames))

	db := sql.DB{}
	frame, err := db.QueryFrames(ctx, gr.refID, gr.query, allFrames)

	rsp := mathexp.Results{}
	if err != nil {
		logger.Error("Failed to query frames", "error", err.Error())
		rsp.Error = err
		return rsp, nil
	}
	logger.Debug("Done Executing query", "query", gr.query, "rows", frame.Rows())

	if frame.Rows() == 0 {
		rsp.Values = mathexp.Values{
			mathexp.NoData{Frame: frame},
		}
		return rsp, nil
	}

	rsp.Values = mathexp.Values{
		mathexp.TableData{Frame: frame},
	}

	return rsp, nil
}

func (gr *SQLCommand) Type() string {
	return TypeSQL.String()
}

func totalCells(frames []*data.Frame) (total int64) {
	for _, frame := range frames {
		if frame != nil {
			// Calculate cells as rows × columns
			rows := int64(frame.Rows())
			cols := int64(len(frame.Fields))
			total += rows * cols
		}
	}
	return
}
