import type { DataQuery } from '@grafana/data';

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
