package filter

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// ErrInvalidFilter is returned when a filter expression is malformed.
var ErrInvalidFilter = errors.New("invalid filter")

// Filter represents a filter expression. It is a sum type, so exactly one
// of the fields should be non-nil.
type Filter struct {
	Logical    *LogicalExpression
	Comparison *ComparisonExpression
	Existence  *ExistenceExpression
}

// LogicalOperator defines the supported logical operators.
type LogicalOperator string

const (
	// And represents a logical AND operation.
	And LogicalOperator = "$and"
	// Or represents a logical OR operation.
	Or LogicalOperator = "$or"
)

// LogicalExpression combines multiple filters using a logical operator.
type LogicalExpression struct {
	Operator LogicalOperator
	Filters  []*Filter
}

// ComparisonOperator defines the supported comparison operators.
type ComparisonOperator string

const (
	Eq  ComparisonOperator = "$eq"
	Ne  ComparisonOperator = "$ne"
	Gt  ComparisonOperator = "$gt"
	Gte ComparisonOperator = "$gte"
	Lt  ComparisonOperator = "$lt"
	Lte ComparisonOperator = "$lte"
	In  ComparisonOperator = "$in"
	Nin ComparisonOperator = "$nin"
)

// ComparisonExpression represents a comparison between a field and a value.
type ComparisonExpression struct {
	Field    string
	Operator ComparisonOperator
	Value    any
}

// ExistenceOperator defines the supported existence operators.
type ExistenceOperator string

const (
	// Exists checks for the presence of a field.
	Exists ExistenceOperator = "$exists"
)

// ExistenceExpression checks for the existence of a field.
type ExistenceExpression struct {
	Field    string
	Operator ExistenceOperator
	Exists   bool
}

// Parse decodes a raw JSON message into a structured Filter object.
func Parse(raw json.RawMessage) (*Filter, error) {
	// Treat empty, whitespace, or explicit null as no filter
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		return nil, nil
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("%w: invalid JSON: %v", ErrInvalidFilter, err)
	}
	// {} means no filter
	if len(m) == 0 {
		return nil, nil
	}
	return parseMap(m)
}

func parseMap(m map[string]any) (*Filter, error) {
	if len(m) == 0 {
		return nil, fmt.Errorf("%w: empty filter expression", ErrInvalidFilter)
	}

	// Handle logical operators ($and, $or)
	for k, v := range m {
		op := strings.ToLower(k)
		if op == string(And) || op == string(Or) {
			if len(m) > 1 {
				return nil, fmt.Errorf("%w: logical operator %s must be the sole key in an expression", ErrInvalidFilter, k)
			}
			return parseLogical(LogicalOperator(op), v)
		}
	}

	// At this point, it must be a set of field expressions.
	// We'll combine them with an implicit AND if there are multiple.
	var filters []*Filter
	for field, expr := range m {
		f, err := parseFieldExpression(field, expr)
		if err != nil {
			return nil, err
		}
		filters = append(filters, f)
	}

	if len(filters) == 1 {
		return filters[0], nil
	}

	return &Filter{Logical: &LogicalExpression{Operator: And, Filters: filters}}, nil
}

func parseLogical(op LogicalOperator, value any) (*Filter, error) {
	expressions, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("%w: value for %s must be an array of expressions", ErrInvalidFilter, op)
	}
	if len(expressions) == 0 {
		return nil, fmt.Errorf("%w: expression array for %s must not be empty", ErrInvalidFilter, op)
	}

	var filters []*Filter
	for _, expr := range expressions {
		m, ok := expr.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("%w: logical expression must be a JSON object", ErrInvalidFilter)
		}
		f, err := parseMap(m)
		if err != nil {
			return nil, err
		}
		filters = append(filters, f)
	}

	return &Filter{Logical: &LogicalExpression{Operator: op, Filters: filters}}, nil
}

func parseFieldExpression(field string, expr any) (*Filter, error) {
	// Simple equality: {"field": "value"}
	if isPrimitive(expr) {
		return &Filter{Comparison: &ComparisonExpression{Field: field, Operator: Eq, Value: expr}}, nil
	}

	m, ok := expr.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%w: field expression for %q must be a primitive or a JSON object", ErrInvalidFilter, field)
	}

	// Multiple conditions on one field: {"field": {"$gt": 10, "$lt": 20}}
	if len(m) > 1 {
		var filters []*Filter
		for op, val := range m {
			f, err := parseOperatorExpression(field, op, val)
			if err != nil {
				return nil, err
			}
			filters = append(filters, f)
		}
		return &Filter{Logical: &LogicalExpression{Operator: And, Filters: filters}}, nil
	}

	// Single condition: {"field": {"$op": "value"}}
	for op, val := range m {
		return parseOperatorExpression(field, op, val)
	}

	return nil, fmt.Errorf("%w: invalid field expression for %q", ErrInvalidFilter, field)
}

func parseOperatorExpression(field, op string, val any) (*Filter, error) {
	op = strings.ToLower(op)

	// Existence check
	if op == string(Exists) {
		exists, ok := val.(bool)
		if !ok {
			return nil, fmt.Errorf("%w: value for $exists must be a boolean", ErrInvalidFilter)
		}
		expr := &ExistenceExpression{Field: field, Operator: Exists, Exists: exists}
		return &Filter{Existence: expr}, nil
	}

	// Comparison operators
	compOp := ComparisonOperator(op)
	var expr *ComparisonExpression
	switch compOp {
	case Eq, Ne:
		if !isPrimitive(val) {
			return nil, fmt.Errorf("%w: value for %s must be a string, number, or boolean", ErrInvalidFilter, compOp)
		}
		expr = &ComparisonExpression{Field: field, Operator: compOp, Value: val}
	case Gt, Gte, Lt, Lte:
		if _, ok := val.(float64); !ok {
			return nil, fmt.Errorf("%w: value for %s must be a number", ErrInvalidFilter, compOp)
		}
		expr = &ComparisonExpression{Field: field, Operator: compOp, Value: val}
	case In, Nin:
		arr, ok := val.([]any)
		if !ok || len(arr) == 0 {
			return nil, fmt.Errorf("%w: value for %s must be a non-empty array", ErrInvalidFilter, compOp)
		}
		for _, item := range arr {
			if !isPrimitive(item) {
				return nil, fmt.Errorf("%w: items in %s array must be primitive values", ErrInvalidFilter, compOp)
			}
		}
		expr = &ComparisonExpression{Field: field, Operator: compOp, Value: arr}
	default:
		return nil, fmt.Errorf("%w: unknown operator %q", ErrInvalidFilter, op)
	}
	return &Filter{Comparison: expr}, nil
}

func isPrimitive(v any) bool {
	switch v.(type) {
	case string, float64, bool:
		return true
	default:
		return false
	}
}
