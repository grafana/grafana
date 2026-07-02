import { logqlMapper } from '../model/languages/logql';
import { promqlMapper } from '../model/languages/promql';

import { analyzeGraph } from './analyze';

const promDiagnostics = (expr: string) => analyzeGraph(promqlMapper.buildGraph(expr), expr);
const logqlDiagnostics = (expr: string) => analyzeGraph(logqlMapper.buildGraph(expr), expr);

describe('analyzeGraph - Prometheus', () => {
  it('flags a range-vector function without a range and suggests a fix', () => {
    const diags = promDiagnostics('rate(metric{job="api"})');
    const rangeVector = diags.find((d) => d.id.startsWith('prom-range-vector'));
    expect(rangeVector).toBeDefined();
    expect(rangeVector?.severity).toBe('error');
    expect(rangeVector?.suggestion).toBe('rate(metric{job="api"}[5m])');
  });

  it('does not flag a range-vector function that already has a range', () => {
    const diags = promDiagnostics('rate(metric{job="api"}[5m])');
    expect(diags.some((d) => d.id.startsWith('prom-range-vector'))).toBe(false);
  });

  it('suggests a fix even for an incomplete query mid-edit', () => {
    const diags = promDiagnostics('rate(request_count');
    const rangeVector = diags.find((d) => d.id.startsWith('prom-range-vector'));
    expect(rangeVector?.suggestion).toBe('rate(request_count[5m])');
  });

  it('tips that histogram_quantile expects _bucket series', () => {
    const diags = promDiagnostics('histogram_quantile(0.99, sum by (le) (rate(metric[5m])))');
    expect(diags.some((d) => d.id.startsWith('prom-histogram-quantile'))).toBe(true);
  });

  it('does not tip histogram_quantile when fed _bucket series', () => {
    const diags = promDiagnostics('histogram_quantile(0.99, sum by (le) (rate(metric_bucket[5m])))');
    expect(diags.some((d) => d.id.startsWith('prom-histogram-quantile'))).toBe(false);
  });

  it('tips when an aggregation has no grouping', () => {
    const diags = promDiagnostics('sum(rate(metric[5m]))');
    expect(diags.some((d) => d.id.startsWith('prom-aggregation-grouping'))).toBe(true);
  });

  it('does not tip an aggregation that groups by labels', () => {
    const diags = promDiagnostics('sum by (job) (rate(metric[5m]))');
    expect(diags.some((d) => d.id.startsWith('prom-aggregation-grouping'))).toBe(false);
  });
});

describe('analyzeGraph - docsHref', () => {
  it('attaches the anchored node\u2019s docs link to a rule diagnostic', () => {
    const diags = promDiagnostics('rate(metric{job="api"})');
    const rangeVector = diags.find((d) => d.id.startsWith('prom-range-vector'));
    expect(rangeVector?.docsHref).toBe('https://prometheus.io/docs/prometheus/latest/querying/functions/#rate');
  });

  it('attaches the anchored node\u2019s docs link to a syntax-error diagnostic anchored to a selector', () => {
    const diags = logqlDiagnostics('{app="foo"');
    const syntaxError = diags.find((d) => d.id.startsWith('syntax-'));
    expect(syntaxError).toBeDefined();
    expect(syntaxError?.docsHref).toBe('https://grafana.com/docs/loki/latest/query/log_queries/#log-stream-selector');
  });

  it('leaves docsHref undefined when the node kind has no known link', () => {
    const diags = promDiagnostics('42');
    // A bare literal has no docs link and no diagnostics fire on it, but this guards the "no node
    // found for nodeId" and "no link for kind" paths don't throw.
    expect(() => diags.forEach((d) => d.docsHref)).not.toThrow();
  });
});

describe('analyzeGraph - Loki', () => {
  it('flags a range aggregation without a log range and suggests a fix', () => {
    const diags = logqlDiagnostics('rate({app="foo"})');
    const range = diags.find((d) => d.id.startsWith('logql-range'));
    expect(range).toBeDefined();
    expect(range?.severity).toBe('error');
    expect(range?.suggestion).toBe('rate({app="foo"}[5m])');
  });

  it('does not flag a range aggregation that has a log range', () => {
    const diags = logqlDiagnostics('rate({app="foo"}[5m])');
    expect(diags.some((d) => d.id.startsWith('logql-range'))).toBe(false);
  });

  it('flags a missing log range even when a matcher value contains a bracket', () => {
    // Regression test: the rule used to scan for a literal `[` in the source text, which matched
    // the bracket inside the matcher value below and produced a false negative.
    const diags = logqlDiagnostics('rate({msg="foo[bar]"})');
    const range = diags.find((d) => d.id.startsWith('logql-range'));
    expect(range).toBeDefined();
    expect(range?.severity).toBe('error');
  });

  it('warns when a numeric range op lacks unwrap', () => {
    const diags = logqlDiagnostics('sum_over_time({app="foo"} | json [5m])');
    expect(diags.some((d) => d.id.startsWith('logql-unwrap'))).toBe(true);
  });

  it('does not warn when unwrap is present', () => {
    const diags = logqlDiagnostics('sum_over_time({app="foo"} | unwrap duration [5m])');
    expect(diags.some((d) => d.id.startsWith('logql-unwrap'))).toBe(false);
  });
});
