package vector

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/search/vector/filter"
)

// paramBuilder accumulates positional query args, handing out $N placeholders
// in order so a metadata-set expression, scope predicates, and a compiled
// filter can share one parameter sequence.
type paramBuilder struct {
	args []any
	idx  int
}

func newParamBuilder() *paramBuilder {
	return &paramBuilder{idx: 1}
}

func (p *paramBuilder) add(v any) string {
	p.args = append(p.args, v)
	ph := fmt.Sprintf("$%d", p.idx)
	p.idx++
	return ph
}

// buildMetadataExpr renders the new metadata value: set is merged first
// (NULL-safe), then unset keys are removed. Returns "metadata" unchanged when
// both are empty (callers reject that case before reaching here).
func (p *paramBuilder) buildMetadataExpr(set json.RawMessage, unset []string) string {
	expr := "metadata"
	if len(set) > 0 {
		expr = fmt.Sprintf("(COALESCE(%s, '{}'::jsonb) || %s::jsonb)", expr, p.add(string(set)))
	}
	if len(unset) > 0 {
		expr = fmt.Sprintf("(%s - %s::text[])", expr, p.add(pqStringArray(unset)))
	}
	return expr
}

// buildFilterExpr compiles f into a WHERE fragment prefixed with " AND ",
// continuing this builder's placeholder sequence. Empty when f is nil.
func (p *paramBuilder) buildFilterExpr(f *filter.Filter) (string, error) {
	where, args, err := filter.Compile(f, filter.FilterArgsOffset(p.idx), filter.FilterAnd())
	if err != nil {
		return "", err
	}
	p.args = append(p.args, args...)
	p.idx += len(args)
	return where, nil
}

// scopePredicate renders `resource = $ AND namespace = $ [AND model = $]`,
// adding the args to p. Model is skipped when allModels is set.
func scopePredicate(p *paramBuilder, namespace, model, resource string, allModels bool) string {
	pred := fmt.Sprintf("resource = %s AND namespace = %s", p.add(resource), p.add(namespace))
	if !allModels {
		pred += " AND model = " + p.add(model)
	}
	return pred
}

// deleteByFilter deletes one page of rows matching sel.Filter (ctid paging,
// like the All path) and reports whether more remain.
func (b *pgvectorBackend) deleteByFilter(ctx context.Context, namespace, model, resource string, sel DeleteSelector) (int64, bool, error) {
	limit := sel.Limit
	if limit <= 0 {
		limit = defaultDeleteAllPageSize
	}

	p := newParamBuilder()
	scope := scopePredicate(p, namespace, model, resource, sel.AllModels)
	where, err := p.buildFilterExpr(sel.Filter)
	if err != nil {
		return 0, false, fmt.Errorf("compile filter: %w", err)
	}
	// Outer scope repeats to keep partition pruning; the inner ctid select
	// already pins the exact rows, so the filter need not repeat.
	// scope/where are internal fragments (hardcoded columns + $N placeholders);
	// every caller value is bound via p.args.
	query := fmt.Sprintf( // #nosec G201 nosemgrep: go.lang.security.audit.database.string-formatted-query.string-formatted-query
		`DELETE FROM embeddings WHERE ctid IN (SELECT ctid FROM embeddings WHERE %s%s LIMIT %s) AND %s`,
		scope, where, p.add(limit), scope)
	res, err := b.db.ExecContext(ctx, query, p.args...)
	if err != nil {
		return 0, false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, false, err
	}

	hasMore := false
	if n == int64(limit) {
		pe := newParamBuilder()
		escope := scopePredicate(pe, namespace, model, resource, sel.AllModels)
		ewhere, err := pe.buildFilterExpr(sel.Filter)
		if err != nil {
			return n, false, fmt.Errorf("compile filter: %w", err)
		}
		// escope/ewhere are internal fragments; caller values are bound via pe.args.
		q := fmt.Sprintf(`SELECT EXISTS (SELECT 1 FROM embeddings WHERE %s%s)`, escope, ewhere) // #nosec G201 nosemgrep: go.lang.security.audit.database.string-formatted-query.string-formatted-query
		if err := b.db.QueryRowContext(ctx, q, pe.args...).Scan(&hasMore); err != nil {
			return n, false, fmt.Errorf("check remaining rows: %w", err)
		}
	}
	return n, hasMore, nil
}

// UpdateMetadata patches metadata on filter-matched rows across all models in
// one statement: set merged first, then unset keys removed.
func (b *pgvectorBackend) UpdateMetadata(ctx context.Context, namespace, resource string, f *filter.Filter, set json.RawMessage, unset []string) (int64, error) {
	if f == nil {
		return 0, fmt.Errorf("filter must not be nil")
	}
	if len(set) == 0 && len(unset) == 0 {
		return 0, fmt.Errorf("at least one of set or unset must be provided")
	}
	if err := b.validateResource(ctx, resource); err != nil {
		return 0, err
	}

	p := newParamBuilder()
	metaExpr := p.buildMetadataExpr(set, unset)
	scope := scopePredicate(p, namespace, "", resource, true)
	where, err := p.buildFilterExpr(f)
	if err != nil {
		return 0, fmt.Errorf("compile filter: %w", err)
	}
	// metaExpr/scope/where are internal fragments; set, unset, scope and filter
	// values are all bound via p.args.
	query := fmt.Sprintf(`UPDATE embeddings SET metadata = %s, updated_at = CURRENT_TIMESTAMP WHERE %s%s`, metaExpr, scope, where) // #nosec G201 nosemgrep: go.lang.security.audit.database.string-formatted-query.string-formatted-query
	res, err := b.db.ExecContext(ctx, query, p.args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// pqStringArray formats a Go slice as a Postgres text[] literal for the
// metadata-unset difference operator.
func pqStringArray(ss []string) string {
	quoted := make([]byte, 0, len(ss)*8+2)
	quoted = append(quoted, '{')
	for i, s := range ss {
		if i > 0 {
			quoted = append(quoted, ',')
		}
		quoted = append(quoted, '"')
		for j := 0; j < len(s); j++ {
			if s[j] == '"' || s[j] == '\\' {
				quoted = append(quoted, '\\')
			}
			quoted = append(quoted, s[j])
		}
		quoted = append(quoted, '"')
	}
	quoted = append(quoted, '}')
	return string(quoted)
}
