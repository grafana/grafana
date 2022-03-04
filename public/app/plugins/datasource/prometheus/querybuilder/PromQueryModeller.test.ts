import { PromQueryModeller } from './PromQueryModeller';
import { PromOperationId } from './types';

describe('PromQueryModeller', () => {
  const modeller = new PromQueryModeller();

  it('Can render query with metric only', () => {
    expect(
      modeller.renderQuery({
        metric: 'my_totals',
        labels: [],
        operations: [],
      })
    ).toBe('my_totals');
  });

  it('Can render query with label filters', () => {
    expect(
      modeller.renderQuery({
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
      modeller.renderQuery({
        metric: 'my_totals',
        labels: [],
        operations: [{ id: 'sum', params: [] }],
      })
    ).toBe('sum(my_totals)');
  });

  it('Can render query with function with parameter to left of inner expression', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: PromOperationId.HistogramQuantile, params: [0.86] }],
      })
    ).toBe('histogram_quantile(0.86, metric)');
  });

  it('Can render query with function with function parameters to the right of inner expression', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: PromOperationId.LabelReplace, params: ['server', '$1', 'instance', 'as(.*)d'] }],
      })
    ).toBe('label_replace(metric, "server", "$1", "instance", "as(.*)d")');
  });

  it('Can group by expressions', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: '__sum_by', params: ['server', 'job'] }],
      })
    ).toBe('sum by(server, job) (metric)');
  });

  it('Can render avg around a group by', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [
          { id: '__sum_by', params: ['server', 'job'] },
          { id: 'avg', params: [] },
        ],
      })
    ).toBe('avg(sum by(server, job) (metric))');
  });

  it('Can use aggregation without label', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: '__sum_without', params: ['server', 'job'] }],
      })
    ).toBe('sum without(server, job) (metric)');
  });

  it('Can render aggregations with parameters', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: 'topk', params: [5] }],
      })
    ).toBe('topk(5, metric)');
  });

  it('Can render rate', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [{ label: 'pod', op: '=', value: 'A' }],
        operations: [{ id: PromOperationId.Rate, params: ['$__rate_interval'] }],
      })
    ).toBe('rate(metric{pod="A"}[$__rate_interval])');
  });

  it('Can render increase', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [{ label: 'pod', op: '=', value: 'A' }],
        operations: [{ id: PromOperationId.Increase, params: ['$__interval'] }],
      })
    ).toBe('increase(metric{pod="A"}[$__interval])');
  });

  it('Can render rate with custom range-vector', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [{ label: 'pod', op: '=', value: 'A' }],
        operations: [{ id: PromOperationId.Rate, params: ['10m'] }],
      })
    ).toBe('rate(metric{pod="A"}[10m])');
  });

  it('Can render multiply operation', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric',
        labels: [],
        operations: [{ id: PromOperationId.MultiplyBy, params: [1000] }],
      })
    ).toBe('metric * 1000');
  });

  it('Can render query with simple binary query', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '/',
            query: {
              metric: 'metric_b',
              labels: [],
              operations: [],
            },
          },
        ],
      })
    ).toBe('metric_a / metric_b');
  });

  it('Can render query with multiple binary queries and nesting', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '+',
            query: {
              metric: 'metric_b',
              labels: [],
              operations: [],
            },
          },
          {
            operator: '+',
            query: {
              metric: 'metric_c',
              labels: [],
              operations: [],
            },
          },
        ],
      })
    ).toBe('metric_a + metric_b + metric_c');
  });

  it('Can render query with nested query with binary op', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '/',
            query: {
              metric: 'metric_b',
              labels: [],
              operations: [{ id: PromOperationId.MultiplyBy, params: [1000] }],
            },
          },
        ],
      })
    ).toBe('metric_a / (metric_b * 1000)');
  });

  it('Can render query with nested binary query with parentheses', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '/',
            query: {
              metric: 'metric_b',
              labels: [],
              operations: [],
              binaryQueries: [
                {
                  operator: '*',
                  query: {
                    metric: 'metric_c',
                    labels: [],
                    operations: [],
                  },
                },
              ],
            },
          },
        ],
      })
    ).toBe('metric_a / (metric_b * metric_c)');
  });

  it('Should add parantheis around first query if it has binary op', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [{ id: PromOperationId.MultiplyBy, params: [1000] }],
        binaryQueries: [
          {
            operator: '/',
            query: {
              metric: 'metric_b',
              labels: [],
              operations: [],
            },
          },
        ],
      })
    ).toBe('(metric_a * 1000) / metric_b');
  });

  it('Can render with binary queries with vectorMatches expression', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '/',
            vectorMatches: 'on(le)',
            query: {
              metric: 'metric_b',
              labels: [],
              operations: [],
            },
          },
        ],
      })
    ).toBe('metric_a / on(le) metric_b');
  });
  it('Can render functions that require a range as a parameter', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [{ id: 'holt_winters', params: ['5m', 0.5, 0.5] }],
      })
    ).toBe('holt_winters(metric_a[5m], 0.5, 0.5)');
  });
  it('Can render functions that require parameters left of a range', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [{ id: 'quantile_over_time', params: ['5m', 1] }],
      })
    ).toBe('quantile_over_time(1, metric_a[5m])');
  });
  it('Can render the label_join function', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [{ id: 'label_join', params: ['label_1', ',', 'label_2'] }],
      })
    ).toBe('label_join(metric_a, "label_1", ",", "label_2")');
  });
  it('Can render label_join with extra parameters', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [{ id: 'label_join', params: ['label_1', ', ', 'label_2', 'label_3', 'label_4', 'label_5'] }],
      })
    ).toBe('label_join(metric_a, "label_1", ", ", "label_2", "label_3", "label_4", "label_5")');
  });
});
