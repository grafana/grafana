package sql

import (
	"context"
	"fmt"
	"time"

	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Time range context helpers
type timeRangeKey struct{}

type TimeRange struct {
	From time.Time
	To   time.Time
}

func WithTimeRange(ctx context.Context, from, to time.Time) context.Context {
	return context.WithValue(ctx, timeRangeKey{}, TimeRange{From: from, To: to})
}

func GetTimeRange(ctx context.Context) (TimeRange, bool) {
	tr, ok := ctx.Value(timeRangeKey{}).(TimeRange)
	return tr, ok
}

type TimeFromFunction struct{}

func NewTimeFromFunction() func(...mysql.Expression) (mysql.Expression, error) {
	return func(...mysql.Expression) (mysql.Expression, error) {
		return TimeFromFunction{}, nil
	}
}

func (f TimeFromFunction) FunctionName() string {
	return "time_from"
}

func (f TimeFromFunction) String() string {
	return fmt.Sprintf("%s()", f.FunctionName())
}

func (f TimeFromFunction) Resolved() bool               { return true }
func (f TimeFromFunction) IsNullable() bool             { return true }
func (f TimeFromFunction) Children() []mysql.Expression { return nil }
func (f TimeFromFunction) Type() mysql.Type             { return types.Timestamp }
func (f TimeFromFunction) Eval(ctx *mysql.Context, _ mysql.Row) (interface{}, error) {
	if tr, ok := GetTimeRange(ctx.Context); ok {
		return tr.From, nil
	}
	return nil, nil
}

func (f TimeFromFunction) WithChildren(children ...mysql.Expression) (mysql.Expression, error) {
	if len(children) != 0 {
		return nil, mysql.ErrInvalidChildrenNumber.New(f, len(children), 0)
	}
	return f, nil
}

type TimeToFunction struct{}

func NewTimeToFunction() func(...mysql.Expression) (mysql.Expression, error) {
	return func(...mysql.Expression) (mysql.Expression, error) {
		return TimeToFunction{}, nil
	}
}

func (f TimeToFunction) FunctionName() string {
	return "time_to"
}

func (f TimeToFunction) String() string {
	return fmt.Sprintf("%s()", f.FunctionName())
}

func (f TimeToFunction) Resolved() bool               { return true }
func (f TimeToFunction) IsNullable() bool             { return true }
func (f TimeToFunction) Children() []mysql.Expression { return nil }
func (f TimeToFunction) Type() mysql.Type             { return types.Timestamp }
func (f TimeToFunction) Eval(ctx *mysql.Context, _ mysql.Row) (interface{}, error) {
	if tr, ok := GetTimeRange(ctx.Context); ok {
		return tr.To, nil
	}
	return nil, nil
}

func (f TimeToFunction) WithChildren(children ...mysql.Expression) (mysql.Expression, error) {
	if len(children) != 0 {
		return nil, mysql.ErrInvalidChildrenNumber.New(f, len(children), 0)
	}
	return f, nil
}
