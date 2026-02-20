import { DataQuery } from '@grafana/data';
import { ExpressionDatasourceUID, ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';

function isExpressionQuery(query: DataQuery): query is ExpressionQuery {
  return query.datasource?.uid === ExpressionDatasourceUID;
}

/**
 * Extracts refIds that an Expression query depends on.
 */
function extractDependencies(query: DataQuery): string[] {
  if (!isExpressionQuery(query)) {
    return [];
  }

  const deps: string[] = [];
  const expr = query;

  // Math/Reduce/Resample/Threshold: $A, $B pattern
  if (expr.expression) {
    const dollarMatches = expr.expression.match(/\$([A-Z])/g);
    if (dollarMatches) {
      deps.push(...dollarMatches.map((m) => m.slice(1)));
    }

    // SQL: FROM A, JOIN B pattern (single capital letter as table name)
    if (expr.type === ExpressionQueryType.sql) {
      const sqlMatches = expr.expression.match(/(?:FROM|JOIN)\s+([A-Z])(?:\s|$|,)/gi);
      if (sqlMatches) {
        deps.push(...sqlMatches.map((m) => m.replace(/(?:FROM|JOIN)\s+/i, '').trim().charAt(0)));
      }
    }
  }

  // Classic Conditions: conditions[].query.params[0]
  if (expr.conditions) {
    for (const condition of expr.conditions) {
      if (condition.query?.params?.[0]) {
        deps.push(condition.query.params[0]);
      }
    }
  }

  return [...new Set(deps)];
}

/**
 * Filters hidden queries from the list, preserving queries that are
 * referenced by visible Expression queries.
 */
export function filterHiddenQueries(queries: DataQuery[]): DataQuery[] {
  const hiddenQueries = queries.filter((q) => q.hide);
  if (hiddenQueries.length === 0) {
    return queries;
  }

  const visibleQueries = queries.filter((q) => !q.hide);

  // Pre-compute dependencies for all queries
  const depsMap = new Map<string, string[]>();
  for (const q of queries) {
    depsMap.set(q.refId, extractDependencies(q));
  }

  // BFS to find all required refIds (using index to avoid O(n) shift)
  const required = new Set<string>();
  const visited = new Set<string>();
  const queue = visibleQueries.flatMap((q) => depsMap.get(q.refId) || []);

  for (let i = 0; i < queue.length; i++) {
    const refId = queue[i];
    if (visited.has(refId)) {
      continue;
    }
    visited.add(refId);
    required.add(refId);

    const deps = depsMap.get(refId) || [];
    queue.push(...deps.filter((d) => !visited.has(d)));
  }

  // Include visible queries + required hidden queries
  const requiredHidden = hiddenQueries.filter((q) => required.has(q.refId));

  return [...visibleQueries, ...requiredHidden];
}
