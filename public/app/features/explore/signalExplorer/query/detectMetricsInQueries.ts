import type { DataQuery } from '@grafana/data';

/**
 * Which of `knownMetricNames` each query's `expr` mentions, as `{ refId: metricNames[] }`.
 *
 * Advisory only, and deliberately dumb — two limitations to know before relying on it:
 * - **No PromQL awareness.** It tokenizes the expression and looks every identifier up in the
 *   catalog, so a catalog name that also appears inside a string literal, a label name or a label
 *   value (`{job="up"}` reports `up`) is counted as a match. Fine for a "you already query this"
 *   badge; not a parser.
 * - **ASCII identifiers only.** Tokens are `[a-zA-Z0-9_:]+`, so a Prometheus 3.x UTF-8 name (or any
 *   quoted name) in the catalog is never detected.
 *
 * The caller is also responsible for passing only the catalog of the datasource these queries run
 * against: a metric name means nothing outside the datasource that defines it.
 */
export function detectMetricsInQueries(
  queries: DataQuery[],
  knownMetricNames: ReadonlySet<string>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const q of queries) {
    if (!('expr' in q) || typeof q.expr !== 'string' || q.expr === '') {
      continue;
    }
    // Tokenize once: O(exprLength), not O(exprLength × catalogSize).
    // Extract all maximal identifier runs, then check Set membership.
    const tokens = Array.from(q.expr.matchAll(/[a-zA-Z0-9_:]+/g), (m) => m[0]);
    const found: string[] = [];
    const seen = new Set<string>();
    for (const token of tokens) {
      if (!seen.has(token) && knownMetricNames.has(token)) {
        found.push(token);
        seen.add(token);
      }
    }
    if (found.length > 0) {
      out[q.refId] = found;
    }
  }
  return out;
}
