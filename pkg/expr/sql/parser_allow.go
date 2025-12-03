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

	walkSubtree := func(node sqlparser.SQLNode) error {
		err := sqlparser.Walk(func(node sqlparser.SQLNode) (bool, error) {
			if !allowedNode(node) {
				if fT, ok := node.(*sqlparser.FuncExpr); ok {
					return false, MakeBlockedNodeOrFuncError(refID, fT.Name.String(), true)
				}
				return false, MakeBlockedNodeOrFuncError(refID, fmt.Sprintf("%T", node), false)
			}
			return true, nil
		}, node)

		if err != nil {
			var bn *ErrorWithCategory
			if !errors.As(err, &bn) {
				return fmt.Errorf("failed to parse SQL expression: %w", err)
			}
			return err
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

	case sqlparser.BoolVal, *sqlparser.NullVal:
		return

	case *sqlparser.CaseExpr, *sqlparser.When:
		return

	case *sqlparser.CharExpr:
		return

	case sqlparser.ColIdent, *sqlparser.ColName, sqlparser.Columns, sqlparser.ColumnType:
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

	case *sqlparser.IndexHints:
		return

	case *sqlparser.IntervalExpr:
		return

	case *sqlparser.Into:
		return

	case *sqlparser.IsExpr:
		return

	case *sqlparser.JoinTableExpr, sqlparser.JoinCondition:
		return

	case *sqlparser.JSONTableExpr, *sqlparser.JSONTableSpec, *sqlparser.JSONTableColDef:
		return

	case *sqlparser.Select, sqlparser.SelectExprs, *sqlparser.ParenSelect:
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
	case "least":
		return

	// Aggregation functions
	case "sum", "avg", "count", "min", "max":
		return
	case "stddev", "std", "stddev_pop", "stddev_sample":
		return
	case "variance", "var_pop", "var_samp":
		return
	case "group_concat":
		return

	// Window Functions
	case "row_number", "rank", "dense_rank", "percent_rank":
		return
	case "first_value", "last_value", "ntile":
		return
	case "lead", "lag":
		return

	// Mathematical functions
	case "abs":
		return
	case "round", "floor", "ceiling", "ceil":
		return
	case "sqrt", "pow", "power":
		return
	case "mod", "log", "log2", "log10", "exp":
		return
	case "sign", "ln", "truncate":
		return
	case "sin", "cos", "tan", "cot":
		return
	case "asin", "acos", "atan", "atan2":
		return
	case "conv", "degrees", "radians":
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
	case "elt", "quote":
		return
	case "from_base64", "format":
		return
	case "regexp_substr", "regexp_replace", "regexp_instr", "regexp_like":
		return

	// Date functions
	case "str_to_date":
		return
	case "date_format", "get_format":
		return
	case "date_add", "adddate", "date_sub", "subdate":
		return
	case "year", "month", "day", "weekday", "last_day":
		return
	case "yearweek", "weekofyear":
		return
	case "datediff":
		return
	case "unix_timestamp", "from_unixtime":
		return
	case "extract", "hour", "minute", "second", "microsecond":
		return
	case "dayname", "monthname", "dayofweek", "dayofmonth", "dayofyear":
		return
	case "week", "quarter", "time_to_sec", "sec_to_time":
		return
	case "timestampdiff", "timestampadd":
		return
	case "from_days", "to_days":
		return
	case "time_format", "time", "timediff":
		return

	// Type conversion
	case "cast", "convert":
		return

	// JSON functions
	case "json_extract", "json_object", "json_array", "json_valid":
		return
	case "json_merge", "json_merge_patch", "json_merge_preserve":
		return
	case "json_contains", "json_length", "json_type", "json_keys":
		return
	case "json_contains_path", "json_depth":
		return
	case "json_search", "json_quote", "json_unquote":
		return
	case "json_set", "json_insert", "json_replace", "json_remove":
		return
	case "json_array_append", "json_array_insert":
		return
	case "json_objectagg", "json_arrayagg":
		return
	case "json_overlaps":
		return
	case "json_pretty", "json_value":
		return

	default:
		return false
	}
}
