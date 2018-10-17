package prometheus

import (
	"errors"
	"fmt"

	"github.com/prometheus/prometheus/promql"
)

// NewQueryValidator returns a new QueryValidator for the given query, or error
// in case of parsing errors
func NewQueryValidator(query string) (QueryValidator, error) {
	promExpr, err := promql.ParseExpr(query)
	if err != nil {
		return QueryValidator{}, fmt.Errorf("Failed to parse Prometheus query: %s", err)
	}
	validator := QueryValidator{
		query: promExpr,
	}
	return validator, nil
}

// QueryValidator offers validation of a prometheus query, according to the
// configured user permissions
type QueryValidator struct {
	query promql.Expr
}

// Visit validates a single node in the query tree
func (visitor *QueryValidator) Visit(node promql.Node, path []promql.Node) (promql.Visitor, error) {
	isFilterValid := false

	switch node.(type) {
	case *promql.VectorSelector:
		/*selector := node.(*promql.VectorSelector)
		for i := range selector.LabelMatchers {
			// TODO get name from settings
			// TODO get value from session
			matcher := selector.LabelMatchers[i]
			if matcher.Name == "cid" && matcher.Value == "10109" {
				isFilterValid = true
			}
		}*/
		isFilterValid = true
	default:
		// no limiting node, filter okay
		isFilterValid = true
	}

	if !isFilterValid {
		return nil, errors.New("Query could not be validated: selector without filter found - permission denied")
	}

	return visitor, nil
}

// Validate walks through the given query tree and validates the user permissions
func (visitor *QueryValidator) Validate() error {
	err := promql.Walk(visitor, visitor.query, []promql.Node{})
	return err
}
