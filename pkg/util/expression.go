package util

import (
	"fmt"
	"github.com/prometheus/prometheus/promql"
	"github.com/prometheus/prometheus/pkg/labels"
)



func processExpr(node promql.Node, labelName string, labelValue string) {
	switch expr := node.(type) {
	case *promql.EvalStmt:
		processExpr(expr.Expr, labelName, labelValue)

	case promql.Expressions:
		for _, item := range expr {
			processExpr(item, labelName, labelValue)
		}

	case *promql.AggregateExpr:
		if nil != expr.Expr {
			processExpr(expr.Expr, labelName, labelValue)
		}
		if nil !=  expr.Param {
			processExpr(expr.Param, labelName, labelValue)
		}

	case *promql.BinaryExpr:
		processExpr(expr.LHS, labelName, labelValue)
		processExpr(expr.RHS, labelName, labelValue)

	case *promql.Call:
		processExpr(expr.Args, labelName, labelValue)

	case *promql.ParenExpr:
		processExpr(expr.Expr, labelName, labelValue)

	case *promql.MatrixSelector:
		m := labels.Matcher {
			Type: labels.MatchEqual,
			Name: labelName,
			Value: labelValue,
		}

		mStr := m.String()
		for _, item := range expr.LabelMatchers {
			if item.String() == mStr { return }
		}
        expr.LabelMatchers = append(expr.LabelMatchers, &m)

	case *promql.VectorSelector:
		m := labels.Matcher {
			Type: labels.MatchEqual,
			Name: labelName,
			Value: labelValue,
		}

		mStr := m.String()
		for _, item := range expr.LabelMatchers {
			if item.String() == mStr { return }
		}
		expr.LabelMatchers = append(expr.LabelMatchers, &m)
	
	case *promql.UnaryExpr:
		processExpr(expr.Expr, labelName, labelValue)

	default:
	}
}

func ParseExpr(strExpr string, labelName string, labelValue string) string {
	var errUnexpected = fmt.Errorf("unexpected error")
        expr, err := promql.ParseExpr(strExpr)
        // Unexpected errors are always caused by a bug.
        if err == errUnexpected {
                return ""
        }

	processExpr(expr, labelName, labelValue)
	return expr.String()
}

