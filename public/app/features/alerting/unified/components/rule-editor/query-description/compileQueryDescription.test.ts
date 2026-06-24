import { compileQueryDescription, parseQueryFacts } from './compileQueryDescription';

describe('compileQueryDescription', () => {
  it('should describe histogram_quantile latency alert', () => {
    const expr = 'histogram_quantile(0.95, sum by(job, le) (rate(http_request_duration_seconds_bucket{service="web"}[5m])))';
    const result = compileQueryDescription(expr, { threshold: { comparator: '>', value: 0.5 } });

    expect(result.confident).toBe(true);
    expect(result.text).toContain('95th percentile');
    expect(result.text).toContain('http_request_duration_seconds');
    expect(result.text).not.toContain('_bucket');
    expect(result.text).toContain('rises above 0.5');
    expect(result.text).toContain('grouped by job');
    expect(result.text).not.toMatch(/\ble\b/);
  });

  it('should describe summed error rate with groupby and label filter', () => {
    const expr = 'sum by(job) (rate(http_requests_total{code="500"}[5m]))';
    const result = compileQueryDescription(expr, { threshold: { comparator: '>', value: 10 } });

    expect(result.confident).toBe(true);
    expect(result.text).toContain('sum');
    expect(result.text).toContain('rate');
    expect(result.text).toContain('http_requests_total');
    expect(result.text).toContain('5m');
    expect(result.text).toContain('code=500');
    expect(result.text).toContain('grouped by job');
    expect(result.text).toContain('rises above 10');
  });

  it('should describe median as "median" for histogram_quantile(0.5, ...)', () => {
    const expr = 'histogram_quantile(0.5, sum by(le) (rate(request_duration_bucket[5m])))';
    const result = compileQueryDescription(expr);

    expect(result.confident).toBe(true);
    expect(result.text).toContain('median');
    expect(result.text).toContain('request_duration');
  });

  it('should use external threshold when no inline comparison', () => {
    const expr = 'avg(node_cpu_seconds_total)';
    const result = compileQueryDescription(expr, { threshold: { comparator: '>=', value: 0.9 } });

    expect(result.confident).toBe(true);
    expect(result.text).toContain('reaches or exceeds 0.9');
  });

  it('should describe LogQL error-log count', () => {
    const expr = 'sum by(level) (count_over_time({app="api"} |= `error` [5m]))';
    const result = compileQueryDescription(expr, { threshold: { comparator: '>', value: 100 } });

    expect(result.confident).toBe(true);
    expect(result.text).toContain('count over time');
    expect(result.text).toContain('containing "error"');
    expect(result.text).toContain('grouped by level');
    expect(result.text).toContain('rises above 100');
    expect(result.facts.language).toBe('logql');
  });

  it('should describe bare metric with inline comparison (up == 0)', () => {
    const expr = 'up == 0';
    const result = compileQueryDescription(expr);

    expect(result.confident).toBe(true);
    expect(result.text).toContain('up');
    expect(result.text).toContain('equals 0');
  });

  it('should fall back gracefully for unparseable expressions', () => {
    const expr = '~~~';
    const result = compileQueryDescription(expr);

    expect(result.confident).toBe(false);
    expect(result.text).toContain('Fires based on the query');
  });

  it('should return empty text for empty input', () => {
    expect(compileQueryDescription('').text).toBe('');
    expect(compileQueryDescription('  ').text).toBe('');
  });

  it('should handle without() grouping', () => {
    const expr = 'sum without(instance) (rate(http_requests_total[5m]))';
    const result = compileQueryDescription(expr);

    expect(result.confident).toBe(true);
    expect(result.text).toContain('grouped without instance');
  });

  it('should handle < comparator', () => {
    const expr = 'node_memory_free_bytes < 1000000';
    const result = compileQueryDescription(expr);

    expect(result.confident).toBe(true);
    expect(result.text).toContain('drops below 1000000');
  });
});

describe('parseQueryFacts', () => {
  it('should detect PromQL language', () => {
    const facts = parseQueryFacts('rate(http_requests_total[5m])');
    expect(facts.language).toBe('promql');
    expect(facts.func).toBe('rate');
    expect(facts.metric).toBe('http_requests_total');
    expect(facts.rangeWindow).toBe('5m');
  });

  it('should detect LogQL language with line filters', () => {
    const facts = parseQueryFacts('{app="api"} |= `error`');
    expect(facts.language).toBe('logql');
    expect(facts.logLineFilters).toHaveLength(1);
    expect(facts.logLineFilters![0]).toEqual({ op: '|=', value: 'error' });
  });

  it('should extract label matchers', () => {
    const facts = parseQueryFacts('http_requests_total{code="500", method="GET"}');
    expect(facts.labelMatchers).toHaveLength(2);
    expect(facts.labelMatchers![0]).toEqual({ label: 'code', op: '=', value: '500' });
  });

  it('should return unknown for empty input', () => {
    expect(parseQueryFacts('').language).toBe('unknown');
  });
});
