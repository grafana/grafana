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

	// walkNodes validates all nodes in the AST against the allowlist.
	// It supplements sqlparser.Walk to cover fields that upstream walkSubtree
	// implementations skip. SetOp skips OrderBy/With/Limit, and Select skips
	// Window, so those subtrees are walked explicitly here. Lock and Into are
	// handled by rejecting them at the parent Select/SetOp node in allowedNode.
	var walkNodes func(nodes ...sqlparser.SQLNode) error
	walkNodes = func(nodes ...sqlparser.SQLNode) error {
		return sqlparser.Walk(func(node sqlparser.SQLNode) (bool, error) {
			if !allowedNode(node) {
				if fT, ok := node.(*sqlparser.FuncExpr); ok {
					return false, fmt.Errorf("blocked function %s - not supported in queries", fT.Name)
				}
				return false, fmt.Errorf("blocked node %T - not supported in queries", node)
			}

			// Explicitly walk fields that upstream walkSubtree implementations
			// skip. Without this, functions placed in these fields bypass the
			// allowlist entirely.
			switch v := node.(type) {
			case *sqlparser.SetOp:
				// SetOp.walkSubtree only visits Left and Right, skipping
				// OrderBy, With, Limit
				if err := walkNodes(v.OrderBy, v.With, v.Limit); err != nil {
					return false, err
				}
			case *sqlparser.Select:
				// Select.walkSubtree skips Window and Lock.
				if len(v.Window) > 0 {
					if err := walkNodes(v.Window); err != nil {
						return false, err
					}
				}
			}
			return true, nil
		}, nodes...)
	}

	if err := walkNodes(s); err != nil {
		return false, fmt.Errorf("failed to parse SQL expression: %w", err)
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

	case *sqlparser.ColName:
		// Reject @@system variables (e.g. @@hostname, @@version, @@secure_file_priv).
		// These are parsed as ColName with the @@ prefix in Name.val.
		// Also reject @@global.hostname where @@ is in the Qualifier.
		name := v.Name.String()
		if strings.HasPrefix(name, "@@") || strings.HasPrefix(name, "@") {
			return false
		}
		if qual := v.Qualifier.Name.String(); strings.HasPrefix(qual, "@@") {
			return false
		}
		return

	case sqlparser.ColIdent, sqlparser.Columns:
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

	case *sqlparser.Frame, *sqlparser.FrameExtent, *sqlparser.FrameBound:
		return

	case *sqlparser.IndexHints:
		return

	case *sqlparser.Into:
		// Plain SELECT statements may carry a typed-nil Into pointer.
		// Reject only when INTO is actually present.
		return v == nil

	case *sqlparser.JoinTableExpr, sqlparser.JoinCondition:
		return

	case *sqlparser.Select:
		return v.Lock == ""

	case sqlparser.SelectExprs:
		return

	case *sqlparser.SetOp:
		// SetOp.walkSubtree() does not traverse Into, so reject explicitly.
		return v.GetInto() == nil && v.Lock == ""

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

	case sqlparser.Window, *sqlparser.WindowDef:
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
