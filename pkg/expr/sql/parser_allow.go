package sql

import (
	"errors"
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/vt/sqlparser"
)

// AllowQuery parses the query and checks it against an allow list of allowed SQL nodes
// and functions.
func AllowQuery(refID, rawSQL string) (bool, error) {
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
					return false, MakeBlockedNodeOrFuncError(refID, fT.Name.String(), true)
				}
				return false, MakeBlockedNodeOrFuncError(refID, fmt.Sprintf("%T", node), false)
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
		var bn *ErrorWithCategory
		if !errors.As(err, &bn) {
			return false, fmt.Errorf("failed to parse SQL expression: %w", err)
		}
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

	case sqlparser.BoolVal, *sqlparser.NullVal:
		return

	case *sqlparser.CaseExpr, *sqlparser.When:
		return

	case *sqlparser.CharExpr:
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

	case sqlparser.ColIdent, sqlparser.Columns, sqlparser.ColumnType:
		return

	case sqlparser.Comments: // TODO: understand why some are pointer vs not
		return

	case *sqlparser.CommonTableExpr:
		return

	case *sqlparser.ComparisonExpr:
		return

	case *sqlparser.ConvertExpr, *sqlparser.ConvertType:
		return

	case *sqlparser.CollateExpr:
		return

	case sqlparser.Exprs:
		return

	case *sqlparser.ExtractFuncExpr:
		return

	case *sqlparser.GroupConcatExpr:
		return

	case sqlparser.GroupBy:
		return

	case *sqlparser.Frame, *sqlparser.FrameExtent, *sqlparser.FrameBound:
		return

	case *sqlparser.IndexHints:
		return

	case *sqlparser.IntervalExpr:
		return

	case *sqlparser.Into:
		// Plain SELECT statements may carry a typed-nil Into pointer.
		// Reject only when INTO is actually present.
		return v == nil

	case *sqlparser.IsExpr:
		return

	case *sqlparser.JoinTableExpr, sqlparser.JoinCondition:
		return

	case *sqlparser.JSONTableExpr, *sqlparser.JSONTableSpec, *sqlparser.JSONTableColDef:
		return

	case *sqlparser.Select:
		return v.Lock == nil || v.Lock.Type == ""

	case sqlparser.SelectExprs, *sqlparser.ParenSelect:
		return

	case *sqlparser.SetOp:
		// SetOp.walkSubtree() does not traverse Into, so reject explicitly.
		return v.GetInto() == nil && (v.Lock == nil || v.Lock.Type == "")

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

	case *sqlparser.RangeCond:
		return

	case *sqlparser.Subquery:
		return

	case sqlparser.TableName, sqlparser.TableExprs, sqlparser.TableIdent:
		return

	case *sqlparser.TimestampFuncExpr:
		return

	case *sqlparser.TrimExpr:
		return

	case sqlparser.ValTuple:
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
	// Conditional functions
	case "if", "coalesce", "ifnull", "nullif":
		return

	// Aggregation functions
	case "sum", "avg", "count", "min", "max":
		return
	case "stddev", "std", "stddev_pop":
		return
	case "variance", "var_pop":
		return
	case "group_concat":
		return
	case "row_number", "rank", "dense_rank", "lead", "lag":
		return
	case "first_value", "last_value":
		return

	// Mathematical functions
	case "abs":
		return
	case "round", "floor", "ceiling", "ceil":
		return
	case "sqrt", "pow", "power":
		return
	case "mod", "log", "log10", "exp":
		return
	case "sign", "ln", "truncate":
		return
	case "sin", "cos", "tan":
		return
	case "asin", "acos", "atan", "atan2":
		return
	case "rand", "pi":
		return

	// String functions
	case "concat", "length", "char_length":
		return
	case "lower", "upper":
		return
	case "substring", "substring_index":
		return
	case "left", "right":
		return
	case "ltrim", "rtrim":
		return
	case "replace", "reverse":
		return
	case "lcase", "ucase", "mid", "repeat":
		return
	case "position", "instr", "locate":
		return
	case "ascii", "ord", "char":
		return
	case "regexp_substr":
		return

	// Date functions
	case "str_to_date":
		return
	case "date_format":
		return
	case "date_add", "date_sub":
		return
	case "year", "month", "day", "weekday":
		return
	case "datediff":
		return
	case "unix_timestamp", "from_unixtime":
		return
	case "extract", "hour", "minute", "second":
		return
	case "dayname", "monthname", "dayofweek", "dayofmonth", "dayofyear":
		return
	case "week", "quarter", "time_to_sec", "sec_to_time":
		return
	case "timestampdiff", "timestampadd":
		return

	// Type conversion
	case "cast", "convert":
		return

	// JSON functions
	case "json_extract", "json_object", "json_array", "json_merge_patch", "json_valid":
		return
	case "json_contains", "json_length", "json_type", "json_keys":
		return
	case "json_search", "json_quote", "json_unquote":
		return
	case "json_set", "json_insert", "json_replace", "json_remove":
		return

	default:
		return false
	}
}
