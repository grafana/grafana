import { logqlMapper } from '../model/languages/logql';
import { promqlMapper } from '../model/languages/promql';

import { analyzeGraph } from './analyze';

const promDiagnostics = (expr: string) => analyzeGraph(promqlMapper.buildGraph(expr), expr);
const logqlDiagnostics = (expr: string) => analyzeGraph(logqlMapper.buildGraph(expr), expr);

const has = (diags: ReturnType<typeof promDiagnostics>, idPrefix: string) =>
  diags.some((d) => d.id.startsWith(idPrefix));

describe('suggestions - Prometheus', () => {
  it('suggests wrapping a bare counter in rate()', () => {
    const diags = promDiagnostics('node_network_receive_bytes_total');
    const counter = diags.find((d) => d.id.startsWith('prom-suggest-counter'));
    expect(counter?.severity).toBe('tip');
    expect(counter?.suggestion).toBe('rate(node_network_receive_bytes_total[5m])');
  });

  it('does not suggest rate() for a counter already fed into rate()', () => {
    const diags = promDiagnostics('rate(node_network_receive_bytes_total[5m])');
    expect(has(diags, 'prom-suggest-counter')).toBe(false);
  });

  it('suggests aggregating an un-aggregated rate()', () => {
    const diags = promDiagnostics('rate(metric[5m])');
    expect(has(diags, 'prom-suggest-aggregate')).toBe(true);
  });

  it('does not suggest aggregating a rate() that is already aggregated', () => {
    const diags = promDiagnostics('sum by (job) (rate(metric[5m]))');
    expect(has(diags, 'prom-suggest-aggregate')).toBe(false);
  });

  it('does not suggest aggregating a rate() already consumed by another function (e.g. histogram_quantile)', () => {
    const diags = promDiagnostics('histogram_quantile(0.99, rate(metric_bucket[5m]))');
    expect(has(diags, 'prom-suggest-aggregate')).toBe(false);
  });

  it('suggests summarizing a bare non-counter selector', () => {
    const diags = promDiagnostics('up');
    expect(has(diags, 'prom-suggest-summarize')).toBe(true);
  });

  it('does not suggest summarizing a counter (the counter tip covers it)', () => {
    const diags = promDiagnostics('http_requests_total');
    expect(has(diags, 'prom-suggest-summarize')).toBe(false);
    expect(has(diags, 'prom-suggest-counter')).toBe(true);
  });
});

describe('suggestions - Loki', () => {
  it('suggests a line filter for a bare log stream', () => {
    const diags = logqlDiagnostics('{app="foo"}');
    expect(has(diags, 'logql-suggest-linefilter')).toBe(true);
  });

  it('does not suggest a line filter once one is present', () => {
    const diags = logqlDiagnostics('{app="foo"} |= "error"');
    expect(has(diags, 'logql-suggest-linefilter')).toBe(false);
  });

  it('suggests turning a log query into a metric query', () => {
    const diags = logqlDiagnostics('{app="foo"} |= "error"');
    expect(has(diags, 'logql-suggest-metric')).toBe(true);
  });

  it('does not suggest metric/line-filter next-steps for an existing metric query', () => {
    const diags = logqlDiagnostics('count_over_time({app="foo"}[5m])');
    expect(has(diags, 'logql-suggest-metric')).toBe(false);
    expect(has(diags, 'logql-suggest-linefilter')).toBe(false);
  });

  it('suggests follow-ups after a parser stage', () => {
    const diags = logqlDiagnostics('{app="foo"} | json');
    expect(has(diags, 'logql-suggest-parse')).toBe(true);
  });

  it('does not suggest parse follow-ups once a downstream stage already exists', () => {
    const diags = logqlDiagnostics('{app="foo"} | json | status="500"');
    expect(has(diags, 'logql-suggest-parse')).toBe(false);
  });

  it('does not suggest turning a query into a metric once parsing/labeling has started', () => {
    const diags = logqlDiagnostics('{app="foo"} | json');
    expect(has(diags, 'logql-suggest-metric')).toBe(false);
  });
});
