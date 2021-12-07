import { PromQueryModeller } from './PromQueryModeller';

describe('VisualQueryEngine', () => {
  const engine = new PromQueryModeller();

  it('Can render query with metric only', () => {
    expect(
      engine.renderQuery({
        metric: 'my_totals',
        labels: [],
        operations: [],
      })
    ).toBe('my_totals');
  });

  it('Can render query with label filters', () => {
    expect(
      engine.renderQuery({
        metric: 'my_totals',
        labels: [
          { label: 'cluster', op: '=', value: 'us-east' },
          { label: 'job', op: '=~', value: 'abc' },
        ],
        operations: [],
      })
    ).toBe('my_totals{cluster="us-east", job=~"abc"}');
  });

  it('Can render query with function', () => {
    expect(
      engine.renderQuery({
        metric: 'my_totals',
        labels: [],
        operations: [{ id: 'sum', params: [] }],
      })
    ).toBe('sum(my_totals)');
  });

  it('Can render query with function with parameter to left of inner expression', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: 'histogram_quantile', params: [0.86] }],
      })
    ).toBe('histogram_quantile(0.86, metric)');
  });

  it('Can render query with function with function parameters to the right of inner expression', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: 'label_replace', params: ['server', '$1', 'instance', 'as(.*)d'] }],
      })
    ).toBe('label_replace(metric, "server", "$1", "instance", "as(.*)d")');
  });

  it('Can group by expressions', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: '__sum_by', params: ['server', 'job'] }],
      })
    ).toBe('sum by(server, job) (metric)');
  });

  it('Can render avg around a group by', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [
          { id: '__sum_by', params: ['server', 'job'] },
          { id: 'avg', params: [] },
        ],
      })
    ).toBe('avg(sum by(server, job) (metric))');
  });

  it('Can render aggregations with parameters', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: 'topk', params: [5] }],
      })
    ).toBe('topk(5, metric)');
  });

  it('Can render rate', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [{ label: 'pod', op: '=', value: 'A' }],
        operations: [{ id: 'rate', params: ['auto'] }],
      })
    ).toBe('rate(metric{pod="A"}[$__rate_interval])');
  });

  it('Can render increase', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [{ label: 'pod', op: '=', value: 'A' }],
        operations: [{ id: 'increase', params: ['auto'] }],
      })
    ).toBe('increase(metric{pod="A"}[$__rate_interval])');
  });

  it('Can render rate with custom range-vector', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [{ label: 'pod', op: '=', value: 'A' }],
        operations: [{ id: 'rate', params: ['10m'] }],
      })
    ).toBe('rate(metric{pod="A"}[10m])');
  });

  it('Can render multiply operation', () => {
    expect(
      engine.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: '__multiply_by', params: [1000] }],
      })
    ).toBe('metric * 1000');
  });
});
