package sql

import (
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/vt/sqlparser"
)

// RedactedQuery returns a structure-preserving, value/identifier-redacted version
// of the supplied SQL Expression query. It is intended for usage analytics so we
// can understand how SQL Expressions are being used (joins, aggregations,
// subqueries, CTEs, window functions, etc.) without leaking any potentially
// sensitive content from the query itself.
//
// All literal values are replaced with placeholders (`?` for strings, `0` for
// numeric/hex/bit literals). All user-defined identifiers are replaced with
// deterministic, monotonically numbered placeholders so that structural
// relationships within the same query — for example, joining two tables on the
// same column, referencing the same CTE from multiple places, or aliasing a
// table and then qualifying columns by that alias — remain visible.
//
// Two identifier namespaces are used:
//   - `t<n>` for table-like identifiers: real table names, table aliases,
//     CTE names, and qualifiers in column references. They share a namespace
//     so that `users u` followed by `u.id` redacts to `t2 as t1` / `t1.c1`,
//     preserving the alias-to-table relationship.
//   - `c<n>` for column-like identifiers: column names and SELECT-expression
//     aliases. They share a namespace so that `COUNT(*) AS total ... ORDER BY
//     total` redacts to `... as c1 ... order by c1`, preserving the alias
//     reuse.
//
// The dialect used is whatever Vitess `sqlparser` accepts (which is also the
// dialect used by SQL Expressions for parse/validate). If the query cannot be
// parsed, the original error is returned and no fallback string is produced —
// callers must NOT log the raw query in that case.
func RedactedQuery(rawSQL string) (string, error) {
	stmt, err := sqlparser.Parse(rawSQL)
	if err != nil {
		return "", fmt.Errorf("error parsing sql: %s", err.Error())
	}

	r := newRedactor()
	r.redact(stmt)

	return sqlparser.String(stmt), nil
}

// redactor walks a Vitess AST and rewrites identifier and literal nodes in
// place so that the resulting SQL has the same structure but none of the
// original names or values.
type redactor struct {
	// idents maps a (kind, original lower-cased value) tuple to its assigned
	// placeholder so that all references to the same identifier within a
	// single query share the same placeholder. ColIdent comparisons in
	// Vitess are case-insensitive, and TableIdent comparisons are
	// case-sensitive on the wire but case-insensitive in MySQL by default;
	// we lowercase here for simplicity so that telemetry doesn't depend on
	// casing differences across uses of the same identifier.
	idents map[identKey]string
	// counters tracks the next placeholder number per identifier kind.
	counters map[identKind]int
}

type identKind int

const (
	// identKindTable covers real table names, table aliases, CTE names,
	// and qualifiers used in column references.
	identKindTable identKind = iota
	// identKindColumn covers column names and SELECT-expression aliases.
	identKindColumn
)

func (k identKind) prefix() string {
	switch k {
	case identKindTable:
		return "t"
	case identKindColumn:
		return "c"
	default:
		return "id"
	}
}

type identKey struct {
	kind identKind
	val  string
}

func newRedactor() *redactor {
	return &redactor{
		idents:   make(map[identKey]string),
		counters: make(map[identKind]int),
	}
}

func (r *redactor) name(kind identKind, original string) string {
	if original == "" {
		return ""
	}
	key := identKey{kind: kind, val: strings.ToLower(original)}
	if name, ok := r.idents[key]; ok {
		return name
	}
	r.counters[kind]++
	name := fmt.Sprintf("%s%d", kind.prefix(), r.counters[kind])
	r.idents[key] = name
	return name
}

// redact mutates the supplied AST so that all identifiers and literal values
// are replaced with placeholders. We rewrite during the pre-order traversal
// because the Vitess AST stores values by pointer for some node types
// (e.g. *SQLVal, *ColName, *AliasedExpr, *AliasedTableExpr) and by value for
// others (TableName, ColIdent, TableIdent). For the by-value cases we use the
// parent pointer to update the field in place.
//
// To make sure CTE definitions and references collapse to the same
// placeholder, we pre-walk the AST once to populate the table-like namespace
// with all CTE names. The main walk then naturally maps any reference matching
// a known CTE to that same placeholder.
func (r *redactor) redact(stmt sqlparser.SQLNode) {
	_ = sqlparser.Walk(func(node sqlparser.SQLNode) (bool, error) {
		if cte, ok := node.(*sqlparser.CommonTableExpr); ok && cte.AliasedTableExpr != nil {
			if !cte.As.IsEmpty() {
				_ = r.name(identKindTable, cte.As.String())
			}
		}
		return true, nil
	}, stmt)

	_ = sqlparser.Walk(func(node sqlparser.SQLNode) (bool, error) {
		switch v := node.(type) {
		case *sqlparser.SQLVal:
			r.redactSQLVal(v)

		case *sqlparser.ColName:
			r.redactColName(v)
			return false, nil

		case *sqlparser.AliasedExpr:
			r.redactAliasedExpr(v)

		case *sqlparser.AliasedTableExpr:
			r.redactAliasedTableExpr(v)

		case *sqlparser.CommonTableExpr:
			// The CTE's name is on its embedded AliasedTableExpr and is
			// handled by that case; we just need to redact its column
			// list (e.g. `WITH foo(a, b) AS ...`).
			for i, col := range v.Columns {
				if col.IsEmpty() {
					continue
				}
				v.Columns[i] = sqlparser.NewColIdent(r.name(identKindColumn, col.String()))
			}

		case *sqlparser.StarExpr:
			r.redactStarExpr(v)
			return false, nil

		case *sqlparser.IndexHints:
			r.redactIndexHints(v)
			return false, nil
		}
		return true, nil
	}, stmt)
}

func (r *redactor) redactSQLVal(v *sqlparser.SQLVal) {
	switch v.Type {
	case sqlparser.StrVal:
		v.Val = []byte("?")
	case sqlparser.IntVal, sqlparser.FloatVal, sqlparser.HexNum:
		v.Val = []byte("0")
	case sqlparser.HexVal:
		v.Val = []byte("00")
	case sqlparser.BitVal:
		v.Val = []byte("0")
	case sqlparser.ValArg:
		// Already a placeholder — leave as-is so its name is preserved
		// for any downstream binding logic. Callers do not pass values
		// here today, but be defensive.
	}
}

func (r *redactor) redactColName(c *sqlparser.ColName) {
	if c == nil {
		return
	}
	if !c.Qualifier.IsEmpty() {
		c.Qualifier = r.redactTableName(c.Qualifier)
	}
	if !c.Name.IsEmpty() {
		c.Name = sqlparser.NewColIdent(r.name(identKindColumn, c.Name.String()))
	}
}

func (r *redactor) redactAliasedExpr(a *sqlparser.AliasedExpr) {
	// Wipe the captured raw input expression — Vitess uses it verbatim
	// when re-formatting a SELECT expression, which would re-introduce
	// the original column name / value into the redacted output.
	a.InputExpression = ""
	if !a.As.IsEmpty() {
		a.As = sqlparser.NewColIdent(r.name(identKindColumn, a.As.String()))
	}
}

func (r *redactor) redactAliasedTableExpr(a *sqlparser.AliasedTableExpr) {
	if !a.As.IsEmpty() {
		a.As = sqlparser.NewTableIdent(r.name(identKindTable, a.As.String()))
	}
	if tn, ok := a.Expr.(sqlparser.TableName); ok {
		a.Expr = r.redactTableName(tn)
	}
}

func (r *redactor) redactStarExpr(s *sqlparser.StarExpr) {
	if s == nil {
		return
	}
	if !s.TableName.IsEmpty() {
		s.TableName = r.redactTableName(s.TableName)
	}
}

func (r *redactor) redactIndexHints(h *sqlparser.IndexHints) {
	if h == nil {
		return
	}
	for i, idx := range h.Indexes {
		if idx.IsEmpty() {
			continue
		}
		h.Indexes[i] = sqlparser.NewColIdent(r.name(identKindColumn, idx.String()))
	}
}

// redactTableName returns a redacted TableName. It must be assigned back into
// the parent because TableName is a value type, not a pointer.
func (r *redactor) redactTableName(t sqlparser.TableName) sqlparser.TableName {
	out := sqlparser.TableName{}
	if !t.Name.IsEmpty() {
		out.Name = sqlparser.NewTableIdent(r.name(identKindTable, t.Name.String()))
	}
	if !t.DbQualifier.IsEmpty() {
		out.DbQualifier = sqlparser.NewTableIdent(r.name(identKindTable, t.DbQualifier.String()))
	}
	if !t.SchemaQualifier.IsEmpty() {
		out.SchemaQualifier = sqlparser.NewTableIdent(r.name(identKindTable, t.SchemaQualifier.String()))
	}
	return out
}
