package sql

import (
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/vt/sqlparser"
)

// AllowQuery parses the query and checks it against an allow list of allowed SQL nodes
// and functions.
func AllowQuery(rawSQL string) (bool, error) {
	s, err := sqlparser.Parse(rawSQL)
	if err != nil {
		return false, fmt.Errorf("error parsing sql: %s", err.Error())
	}

	walkSubtree := func(node sqlparser.SQLNode) error {
		err := sqlparser.Walk(func(node sqlparser.SQLNode) (bool, error) {
			if !allowedNode(node) {
				if fT, ok := node.(*sqlparser.FuncExpr); ok {
					return false, fmt.Errorf("blocked function %s - not supported in queries", fT.Name)
				}
				return false, fmt.Errorf("blocked node %T - not supported in queries", node)
			}
			return true, nil
		}, node)

		if err != nil {
			return fmt.Errorf("failed to parse SQL expression: %w", err)
		}

		return nil
	}

	if err := walkSubtree(s); err != nil {
		return false, err
	}

	return true, nil
}

// nolint:gocyclo,nakedret
func allowedNode(node sqlparser.SQLNode) (b bool) {
	b = true // so don't have to return true in every case but default

	switch v := node.(type) {
	case *sqlparser.FuncExpr:
		return allowedFunction(v)

	case *sqlparser.AsOf:
		return

	case *sqlparser.AliasedExpr, *sqlparser.AliasedTableExpr:
		return

	case *sqlparser.AndExpr, *sqlparser.OrExpr:
		return

	case *sqlparser.BinaryExpr, *sqlparser.UnaryExpr:
		return

	case sqlparser.BoolVal:
		return

	case sqlparser.ColIdent, *sqlparser.ColName, sqlparser.Columns:
		return

	case sqlparser.Comments: // TODO: understand why some are pointer vs not
		return

	case *sqlparser.CommonTableExpr:
		return

	case *sqlparser.ComparisonExpr:
		return

	case *sqlparser.ConvertExpr:
		return

	case sqlparser.GroupBy:
		return

	case *sqlparser.IndexHints:
		return

	case *sqlparser.Into:
		return

	case *sqlparser.JoinTableExpr, sqlparser.JoinCondition:
		return

	case *sqlparser.Select, sqlparser.SelectExprs:
		return

	case *sqlparser.SetOp:
		return

	case *sqlparser.StarExpr:
		return

	case *sqlparser.SQLVal:
		return

	case *sqlparser.Limit:
		return

	case *sqlparser.Order, sqlparser.OrderBy:
		return

	case *sqlparser.Over:
		return

	case *sqlparser.ParenExpr:
		return

	case *sqlparser.Subquery:
		return

	case sqlparser.TableName, sqlparser.TableExprs, sqlparser.TableIdent:
		return

	case *sqlparser.With:
		return

	case *sqlparser.Where:
		return

	default:
		return false
	}
}

// nolint:gocyclo,nakedret
func allowedFunction(f *sqlparser.FuncExpr) (b bool) {
	b = true // so don't have to return true in every case but default

	switch strings.ToLower(f.Name.String()) {
	case "if":
		return

	case "sum", "avg", "count", "min", "max":
		return

	case "coalesce":
		return

	case "str_to_date":
		return

	default:
		return false
	}
}
