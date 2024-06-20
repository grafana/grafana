package expr

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/scottlepp/go-duck/duck"

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
	engine      sql.Engine
}

// NewSQLCommand creates a new SQLCommand.
func NewSQLCommand(refID, rawSQL string, engine ...sql.Engine) (*SQLCommand, error) {
	if rawSQL == "" {
		return nil, errutil.BadRequest("sql-missing-query",
			errutil.WithPublicMessage("missing SQL query"))
	}

	eng := DefaultEngine()
	if len(engine) > 0 {
		eng = engine[0]
	}

	tables, err := sql.TablesList(rawSQL, eng)
	if err != nil {
		logger.Warn("invalid sql query", "sql", rawSQL, "error", err)
		return nil, errutil.BadRequest("sql-invalid-sql",
			errutil.WithPublicMessage("error reading SQL command"),
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
		engine:      eng,
	}, nil
}

// UnmarshalSQLCommand creates a SQLCommand from Grafana's frontend query.
func UnmarshalSQLCommand(rn *rawNode) (*SQLCommand, error) {
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
	totalRows := 0
	for _, ref := range gr.varsToQuery {
		results, ok := vars[ref]
		if !ok {
			logger.Warn("no results found for", "ref", ref)
			continue
		}
		frames := results.Values.AsDataFrames(ref)
		exceeds, total := exceedsLimit(frames, gr.limit)
		if exceeds {
			logger.Error("SQL expression results exceeded limit", "limit", gr.limit)
			return mathexp.Results{}, fmt.Errorf("SQL expression results exceeded limit of %d", gr.limit)
		}
		totalRows += total
		allFrames = append(allFrames, frames...)
	}

	if totalRows > int(gr.limit) {
		logger.Error("SQL expression results exceeded limit", "limit", totalRows, "results", gr.limit)
		return mathexp.Results{}, fmt.Errorf("SQL expression - %d results exceeded limit of %d", totalRows, gr.limit)
	}

	logger.Debug("Executing query", "query", gr.query, "frames", len(allFrames))

	rsp := mathexp.Results{}
	var frame = &data.Frame{}
	err := gr.engine.QueryFramesInto(gr.refID, gr.query, allFrames, frame)
	if err != nil {
		logger.Error("Failed to query frames", "error", err.Error())
		rsp.Error = err
		return rsp, nil
	}
	logger.Debug("Done Executing query", "query", gr.query, "rows", frame.Rows())

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

func (gr *SQLCommand) Type() string {
	return TypeSQL.String()
}

func exceedsLimit(frames []*data.Frame, limit int64) (bool, int) {
	total := 0
	for _, frame := range frames {
		if frame != nil {
			if int64(frame.Rows()) > limit {
				return true, frame.Rows()
			}
			total += frame.Rows()
		}
	}
	return int64(total) > limit, total
}

func DefaultEngine() sql.Engine {
	db := duck.NewInMemoryDB()
	return &db
}
