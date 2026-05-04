export const NATIVE_BLOCK_EXPLANATION = `
The \`native(histogram_quantile(0.95, rate(...))\` expression uses the **native()** escape hatch to call a raw PromQL function that has no direct SQL equivalent.

**What it does:** \`histogram_quantile(0.95, ...)\` computes the 95th-percentile latency from a Prometheus histogram. The inner \`rate(...[5m])\` computes per-second bucket fill rates over a 5-minute window.

**Why native()?** Prometheus histogram quantiles require bucket-aware math that can't be expressed in generic SQL aggregations. Wrapping them in \`native()\` signals the query engine to pass this sub-expression directly to the PromQL runtime.

**When to use it:** Whenever you need a PromQL function that operates on histogram buckets (\`histogram_quantile\`, \`histogram_fraction\`), time-window aggregations (\`rate\`, \`irate\`, \`increase\`), or label manipulation (\`label_replace\`).
`.trim();

export const GENERIC_EXPLANATION = (snippet: string) =>
  `This expression \`${snippet.slice(0, 60)}${snippet.length > 60 ? '…' : ''}\` filters the result set to rows matching the specified condition. The WHERE clause is evaluated before GROUP BY, so it reduces the scan range before aggregation — keeping this predicate as selective as possible will improve query performance.`;

export const FOLLOW_UP_RESPONSES: Record<string, string> = {
  why: 'The `native()` wrapper exists because Prometheus histograms store cumulative bucket counts — the quantile calculation must happen in PromQL where the bucket structure is understood. SQL aggregations like SUM or AVG would produce wrong results on raw bucket data.',
  how: 'The engine splits the query at the `native()` boundary: the outer SQL runs against the result DataFrame, while the inner expression is forwarded verbatim to the PromQL evaluator. Results are joined back by label keys.',
  alternative:
    'An alternative is to pre-aggregate the buckets into a single quantile column using a materialized view, then query that view with plain SQL — but you lose the ability to vary the quantile (0.95, 0.99) dynamically.',
  default:
    "That's a great question! In the full implementation, the AI would analyze your specific data shape and query context to give a tailored answer. For this prototype, the AI layer is simulated — but this is exactly the kind of follow-up it would handle.",
};

export const GENERATED_SQL_SNIPPETS: Record<string, string> = {
  'p99 latency': `SELECT
  path,
  native(histogram_quantile(0.99, rate(http_server_requests_seconds_bucket[5m])))
    AS p99_latency_seconds
FROM http_server_requests_seconds_bucket
WHERE timestamp >= UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR)
  AND timestamp <  UNIX_TIMESTAMP(NOW())
GROUP BY path
ORDER BY p99_latency_seconds DESC`,

  'error rate': `SELECT
  path,
  method,
  SUM(CASE WHEN CAST(status AS INT) >= 500 THEN value ELSE 0 END)
    / NULLIF(SUM(value), 0) AS error_rate_pct
FROM http_server_requests_seconds_count
WHERE timestamp >= UNIX_TIMESTAMP(NOW() - INTERVAL 15 MINUTE)
  AND timestamp <  UNIX_TIMESTAMP(NOW())
GROUP BY path, method
ORDER BY error_rate_pct DESC`,

  'top 5 endpoints': `SELECT
  path,
  SUM(native(rate(http_server_requests_seconds_count[5m]))) AS req_per_sec
FROM http_server_requests_seconds_count
WHERE timestamp >= UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR)
GROUP BY path
ORDER BY req_per_sec DESC
LIMIT 5`,

  default: `SELECT
  instance,
  AVG(value)  AS avg_value,
  MAX(value)  AS max_value,
  MIN(value)  AS min_value
FROM process_resident_memory_bytes
WHERE timestamp >= UNIX_TIMESTAMP(NOW() - INTERVAL 30 MINUTE)
GROUP BY instance
ORDER BY avg_value DESC`,
};

export const PANEL_QUESTION_RESPONSES: Record<string, string> = {
  'Single series, few data points':
    'This panel shows **A-series** with a single clean peak around 08:00, reaching a maximum of ~85. The data is sparse (9 points over 6 hours), suggesting either a low-resolution metric or a metric that only records on state changes. The curve has a normal distribution shape — consistent with a gradual ramp-up followed by cool-down.',

  'Single series, many data points':
    'A-series fluctuates between 12 and 20 over the last 6 hours, with no clear trend but noticeable periodic spikes every ~45 minutes. The high-frequency noise suggests this is likely a rate or gauge metric sampled at 15-second intervals. Peak activity around 09:30 could correlate with increased traffic or a background job.',

  'Multiple series, few data points':
    'Three series (A, B, C) show diverging behavior: A-series starts high (~40) and declines, B-series is volatile with a spike at 08:30, and C-series recovers from near-zero to ~60 by the end of the window. The crossover at 09:00 is worth investigating — this pattern is typical of failover or load-balancing scenarios.',

  default:
    'This panel shows time-series data over the last 6 hours. Values appear within a normal operational range. No significant anomalies are detected in this window. Would you like me to compare against a baseline period or look for correlated metrics?',
};

export const GENERATE_PANEL_OUTPUTS = [
  {
    prompt: 'p95 latency by endpoint',
    vizType: 'timeseries' as const,
    sql: GENERATED_SQL_SNIPPETS['p99 latency'].replace('0.99', '0.95').replace('p99', 'p95'),
  },
  {
    prompt: 'error rate',
    vizType: 'barchart' as const,
    sql: GENERATED_SQL_SNIPPETS['error rate'],
  },
  {
    prompt: 'top',
    vizType: 'bargauge' as const,
    sql: GENERATED_SQL_SNIPPETS['top 5 endpoints'],
  },
  {
    prompt: 'memory',
    vizType: 'timeseries' as const,
    sql: GENERATED_SQL_SNIPPETS['default'],
  },
];
