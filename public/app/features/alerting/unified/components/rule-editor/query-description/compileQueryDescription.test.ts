import { compileQueryDescription, parseQueryFacts } from './compileQueryDescription';

describe('compileQueryDescription', () => {
  it('describes a histogram_quantile latency alert', () => {
    const expr =
      'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job)) > 0.5';
    const { text, facts, confident } = compileQueryDescription(expr);

    expect(confident).toBe(true);
    expect(facts.func).toBe('histogram_quantile');
    expect(facts.quantile).toBe(0.95);
    expect(facts.comparator).toBe('>');
    expect(facts.threshold).toBe('0.5');
    expect(text).toBe(
      'Fires when the 95th percentile of `http_request_duration_seconds`, grouped by job rises above 0.5.'
    );
  });

  it('describes a summed error rate with grouping and label filter', () => {
    const expr = 'sum(rate(http_requests_total{code="500"}[5m])) by (job) > 10';
    const { text, facts } = compileQueryDescription(expr);

    expect(facts.aggregation).toBe('sum');
    expect(facts.func).toBe('rate');
    expect(facts.range).toBe('5m');
    expect(facts.groupBy).toEqual(['job']);
    expect(facts.matchers).toEqual([{ label: 'code', op: '=', value: '500' }]);
    expect(text).toBe(
      'Fires when the total per-second rate of `http_requests_total` over the last 5m (filtered to code=500), grouped by job rises above 10.'
    );
  });

  it('handles the median as a special case', () => {
    const { text } = compileQueryDescription('histogram_quantile(0.5, rate(latency_bucket[1m])) > 1');
    expect(text).toContain('median of `latency`');
  });

  it('uses an external threshold when the expression has none inline', () => {
    const expr = 'avg_over_time(cpu_usage_percent[5m])';
    const { text } = compileQueryDescription(expr, { threshold: { comparator: '>=', value: '80' } });
    expect(text).toBe('Fires when the average of `cpu_usage_percent` over the last 5m reaches or exceeds 80.');
  });

  it('describes a LogQL error-log count alert', () => {
    const expr = 'sum by (level) (count_over_time({app="api"} |= "error" [5m])) > 100';
    const { text, facts } = compileQueryDescription(expr);

    expect(facts.language).toBe('logql');
    expect(facts.logFilters).toEqual(['containing "error"']);
    expect(text).toBe(
      'Fires when the total count of log lines from app=api containing "error" over the last 5m, grouped by level rises above 100.'
    );
  });

  it('describes a bare metric with a threshold', () => {
    const { text } = compileQueryDescription('up == 0');
    expect(text).toBe('Fires when the `up` equals 0.');
  });

  it('falls back gracefully on an unparseable expression', () => {
    const { text, confident } = compileQueryDescription('!!!garbage$$$');
    expect(confident).toBe(false);
    expect(text).toContain('Fires based on the query');
  });

  it('returns empty for an empty expression', () => {
    const { text, confident } = compileQueryDescription('   ');
    expect(text).toBe('');
    expect(confident).toBe(false);
  });

  it('detects without() grouping', () => {
    const facts = parseQueryFacts('sum without (instance) (rate(errors_total[5m]))');
    expect(facts.groupBy).toEqual(['instance']);
  });
});
