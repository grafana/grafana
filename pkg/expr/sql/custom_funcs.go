package sql

import (
	"fmt"

	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type SlothFunction struct{}

func (sf SlothFunction) IsNonDeterministic() bool {
	return false
}

// NewSloth creates a new Sloth UDF.
func NewSlothFunction() func(...mysql.Expression) (mysql.Expression, error) {
	return func(...mysql.Expression) (mysql.Expression, error) {
		return SlothFunction{}, nil
	}
}

// Eval implements the Expression interface.
func (f SlothFunction) Eval(ctx *mysql.Context, row mysql.Row) (interface{}, error) {
	return "🦥", nil
}

// FunctionName implements sql.FunctionExpression
func (f SlothFunction) FunctionName() string { return "sloth" }

func (f SlothFunction) String() string { return fmt.Sprintf("%s()", f.FunctionName()) }

// Type implements the Expression interface.
func (f SlothFunction) Type() mysql.Type { return types.LongText }

// Resolved implements the Expression interface.
func (f SlothFunction) Resolved() bool { return true }

// Children implements the Expression interface.
func (f SlothFunction) Children() []mysql.Expression { return nil }

// WithChildren implements the Expression interface.
func (f SlothFunction) WithChildren(children ...mysql.Expression) (mysql.Expression, error) {
	if len(children) != 0 {
		return nil, mysql.ErrInvalidChildrenNumber.New(f, len(children), 0)
	}
	return f, nil
}

// IsNullable implements the Expression interface.
func (f SlothFunction) IsNullable() bool {
	return false
}
