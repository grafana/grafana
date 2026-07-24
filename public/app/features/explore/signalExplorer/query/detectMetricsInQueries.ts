import type { DataQuery } from '@grafana/data';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function detectMetricsInQueries(
  queries: DataQuery[],
  knownMetricNames: ReadonlySet<string>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const q of queries) {
    const exprValue = Object.getOwnPropertyDescriptor(q, 'expr')?.value;
    const expr: string = typeof exprValue === 'string' ? exprValue : '';
    if (!expr) {
      continue;
    }
    const found: string[] = [];
    for (const name of knownMetricNames) {
      // Match the metric name as a whole PromQL identifier — bounded by non-identifier chars.
      const re = new RegExp(`(?:^|[^a-zA-Z0-9_:])${escapeRegExp(name)}(?:$|[^a-zA-Z0-9_:])`);
      if (re.test(expr)) {
        found.push(name);
      }
    }
    if (found.length > 0) {
      out[q.refId] = found;
    }
  }
  return out;
}
