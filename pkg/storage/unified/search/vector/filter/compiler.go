package filter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
)

// This dialect is ported from grafana-assistant-app
// (api/internal/search/index). It carries the same known edge-case
// limitations as the upstream, none of which the current caller (Grafana
// Assistant, small string-valued metadata) hits in practice:
//
//   - $in/$nin extract the field as text (jsonb_extract_path_text), so a
//     numeric or boolean $in also matches a string-typed stored value
//     ({"score":{"$in":[42]}} matches {"score":"42"}).
//   - Filter number literals are decoded as float64, so integers above 2^53
//     lose precision.
//   - $nin does not match rows missing the field (NULL NOT IN (...) is NULL),
//     unlike Mongo semantics.
//   - $exists:false does not match rows whose metadata column is SQL NULL
//     (metadata ? key is NULL there).
//
// Fixes belong upstream so both stay in sync; revisit here if a caller needs
// one of these edge cases before then.

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
	// Eq and Ne use JSONB containment (@>): GIN-index friendly, and correct for
	// array-valued fields — Ne is its exact negation, so it excludes rows whose
	// array contains the value and includes rows missing the field (Mongo $ne).
	if e.Operator == Eq || e.Operator == Ne {
		arg := map[string]any{e.Field: e.Value}
		jsonArg, err := json.Marshal(arg)
		if err != nil {
			return fmt.Errorf("failed to marshal json for @> operator: %w", err)
		}
		// $ne coalesces NULL metadata to {} so NOT (NULL @> ...) doesn't stay
		// NULL and skip metadata-less rows. $eq needs no coalesce (NULL @> ...
		// is already non-matching) and keeps the bare column so the GIN index
		// applies. Bind as string with an explicit ::jsonb cast (like $in).
		if e.Operator == Ne {
			c.where.WriteString("NOT (COALESCE(metadata, '{}'::jsonb) @> ")
		} else {
			c.where.WriteString("(metadata @> ")
		}
		c.addArg(string(jsonArg))
		c.where.WriteString("::jsonb)")
		return nil
	}

	if e.Operator == In || e.Operator == Nin {
		return c.compileIn(e)
	}

	op, err := c.sqlOperator(e.Operator)
	if err != nil {
		return err
	}
	// Range ops need a numeric value. A guarded cast: rows whose value isn't a
	// JSON number yield NULL (never match) instead of aborting the whole
	// statement on a nonnumeric row.
	var path string
	if isNumericOperator(e.Operator) {
		path = c.numericPath(e.Field)
	} else {
		path = c.jsonbPathParam(e.Field)
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

// numericPath extracts a field as numeric only when its JSON value is a
// number, yielding NULL otherwise so a nonnumeric row is skipped rather than
// aborting the statement with a cast error. The field key is bound once.
func (c *compiler) numericPath(field string) string {
	idx := c.addOnlyArg(field)
	return fmt.Sprintf("CASE WHEN jsonb_typeof(metadata -> $%d) = 'number' THEN (metadata ->> $%d)::numeric END", idx, idx)
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
