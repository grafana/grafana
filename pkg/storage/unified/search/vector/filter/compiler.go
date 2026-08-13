package filter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
)

// Compile translates a filter expression into a SQL WHERE clause for a JSONB column.
// It returns the SQL string with placeholders and a slice of arguments.
// Placeholders start at $1.
func Compile(f *Filter, opts ...CompileOption) (string, []any, error) {
	if f == nil {
		return "", nil, nil
	}
	cfg := &compileOptions{prefixAnd: false, startFrom: 1}
	for _, o := range opts {
		if o != nil {
			o(cfg)
		}
	}
	base := 0
	if cfg.startFrom > 1 {
		base = cfg.startFrom - 1
	}
	c := &compiler{
		base:  base,
		args:  make([]any, 0),
		where: &bytes.Buffer{},
	}
	if err := c.compile(f); err != nil {
		return "", nil, err
	}
	where := c.where.String()
	if cfg.prefixAnd && where != "" {
		where = " AND " + where
	}
	return where, c.args, nil
}

// Options pattern
type compileOptions struct {
	prefixAnd bool
	startFrom int // 1-based placeholder index to start from; 0 means default ($1)
}

// CompileOption mutates compile options.
type CompileOption func(*compileOptions)

// FilterAnd prefixes the WHERE clause with " AND " when non-empty.
func FilterAnd() CompileOption { return func(c *compileOptions) { c.prefixAnd = true } }

// FilterArgsOffset sets the first placeholder index (1-based). For example, 4 will emit $4 for the first placeholder.
func FilterArgsOffset(n int) CompileOption { return func(c *compileOptions) { c.startFrom = n } }

type compiler struct {
	base  int
	args  []any
	where *bytes.Buffer
}

func (c *compiler) compile(f *Filter) error {
	switch {
	case f.Logical != nil:
		return c.compileLogical(f.Logical)
	case f.Comparison != nil:
		return c.compileComparison(f.Comparison)
	case f.Existence != nil:
		return c.compileExistence(f.Existence)
	default:
		return fmt.Errorf("invalid filter: empty expression")
	}
}

func (c *compiler) compileLogical(e *LogicalExpression) error {
	if len(e.Filters) == 0 {
		return nil
	}
	op := ""
	switch e.Operator {
	case And:
		op = " AND "
	case Or:
		op = " OR "
	default:
		return fmt.Errorf("unsupported logical operator: %s", e.Operator)
	}

	c.where.WriteString("(")
	for i, f := range e.Filters {
		if i > 0 {
			c.where.WriteString(op)
		}
		if err := c.compile(f); err != nil {
			return err
		}
	}
	c.where.WriteString(")")
	return nil
}

func (c *compiler) compileComparison(e *ComparisonExpression) error {
	// For equality checks, use the JSONB containment operator @> which is highly
	// efficient with a GIN index, especially for high-cardinality data.
	if e.Operator == Eq {
		c.where.WriteString("(metadata @> ")
		// Construct a JSON object like {"field": "value"} for the argument.
		arg := map[string]any{e.Field: e.Value}
		jsonArg, err := json.Marshal(arg)
		if err != nil {
			return fmt.Errorf("failed to marshal json for @> operator: %w", err)
		}
		c.addArg(jsonArg)
		c.where.WriteString(")")
		return nil
	}

	switch e.Operator {
	case In, Nin:
		return c.compileIn(e)
	}

	path := c.jsonbPathParam(e.Field)
	op, err := c.sqlOperator(e.Operator)
	if err != nil {
		return err
	}
	// For numeric comparisons, we need to cast the JSONB value to a numeric type.
	if isNumericOperator(e.Operator) {
		path = fmt.Sprintf("(%s)::numeric", path)
	}

	c.where.WriteString("(")
	c.where.WriteString(path)
	c.where.WriteString(" ")
	c.where.WriteString(op)
	c.where.WriteString(" ")
	c.addArg(e.Value)
	c.where.WriteString(")")

	return nil
}

func (c *compiler) compileIn(e *ComparisonExpression) error {
	values, ok := e.Value.([]any)
	if !ok {
		return fmt.Errorf("invalid $in/$nin value: expected array")
	}
	if len(values) == 0 {
		if e.Operator == In {
			c.where.WriteString("FALSE")
		} else {
			c.where.WriteString("TRUE")
		}
		return nil
	}

	scalarPath := c.jsonbPathParam(e.Field)
	op, err := c.sqlOperator(e.Operator)
	if err != nil {
		return err
	}

	isNin := e.Operator == Nin

	c.where.WriteString("(")
	c.where.WriteString(scalarPath)
	c.where.WriteString(" ")
	c.where.WriteString(op)
	c.where.WriteString(" (")
	for i, v := range values {
		if i > 0 {
			c.where.WriteString(", ")
		}
		c.addArg(v)
	}
	c.where.WriteString(")")

	for _, v := range values {
		if isNin {
			c.where.WriteString(" AND NOT ")
		} else {
			c.where.WriteString(" OR ")
		}
		fieldIdx := c.addOnlyArg(e.Field)
		fmt.Fprintf(c.where, "(metadata->$%d @> ", fieldIdx)
		// Marshal the value as JSON for the @> operator
		jsonVal, err := json.Marshal(v)
		if err != nil {
			return fmt.Errorf("failed to marshal json for @> operator: %w", err)
		}
		c.addArg(string(jsonVal))
		c.where.WriteString("::jsonb)")
	}

	c.where.WriteString(")")
	return nil
}

func (c *compiler) compileExistence(e *ExistenceExpression) error {
	if !e.Exists {
		c.where.WriteString("NOT ")
	}
	c.where.WriteString("(metadata ? ")
	c.addArg(e.Field)
	c.where.WriteString(")")
	return nil
}

func (c *compiler) addArg(v any) {
	c.args = append(c.args, v)
	c.where.WriteString("$" + strconv.Itoa(c.base+len(c.args)))
}

// addOnlyArg appends an argument without writing a placeholder to the WHERE buffer.
func (c *compiler) addOnlyArg(v any) int {
	c.args = append(c.args, v)
	return c.base + len(c.args)
}

// jsonbPathParam returns a SQL snippet that extracts a JSONB field using
// a parameterized key to avoid injecting the field name into SQL text.
func (c *compiler) jsonbPathParam(field string) string {
	idx := c.addOnlyArg(field)
	return fmt.Sprintf("jsonb_extract_path_text(metadata, $%d)", idx)
}

func (c *compiler) sqlOperator(op ComparisonOperator) (string, error) {
	switch op {
	case Eq:
		return "=", nil
	case Ne:
		return "!=", nil
	case Gt:
		return ">", nil
	case Gte:
		return ">=", nil
	case Lt:
		return "<", nil
	case Lte:
		return "<=", nil
	case In:
		return "IN", nil
	case Nin:
		return "NOT IN", nil
	default:
		return "", fmt.Errorf("unsupported comparison operator: %s", op)
	}
}

func isNumericOperator(op ComparisonOperator) bool {
	switch op {
	case Gt, Gte, Lt, Lte:
		return true
	default:
		return false
	}
}
