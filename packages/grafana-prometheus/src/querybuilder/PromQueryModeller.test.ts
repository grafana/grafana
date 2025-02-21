// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/PromQueryModeller.test.ts
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

  it('Can render functions that require a range as a parameter', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [{ id: 'double_exponential_smoothing', params: ['5m', 0.5, 0.5] }],
      })
    ).toBe('double_exponential_smoothing(metric_a[5m], 0.5, 0.5)');
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

  it('can render vector matchers', () => {
    expect(
      modeller.renderQuery({
        metric: 'metric_a',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '/',
            vectorMatches: 'le, foo',
            vectorMatchesType: 'on',
            query: {
              metric: 'metric_b',
              labels: [],
              operations: [],
            },
          },
        ],
      })
    ).toBe('metric_a / on(le, foo) metric_b');
  });

  it('can render bool in binary ops', () => {
    expect(
      modeller.renderQuery({
        metric: 'cluster_namespace_slug_dialer_name',
        labels: [],
        operations: [
          {
            id: '__less_or_equal',
            params: [2, true],
          },
        ],
      })
    ).toBe('cluster_namespace_slug_dialer_name <= bool 2');
  });
});

describe('PromQueryModeller with utf8 support', () => {
  const modeller = new PromQueryModeller();

  it('should render nothing if there is nothing', () => {
    expect(
      modeller.renderQuery({
        metric: undefined,
        labels: [],
        operations: [],
      })
    ).toBe('');

    expect(
      modeller.renderQuery({
        metric: '',
        labels: [],
        operations: [],
      })
    ).toBe('');
  });

  it('should render legacy metric name as usual', () => {
    expect(
      modeller.renderQuery({
        metric: 'not_a_utf8_metric',
        labels: [],
        operations: [],
      })
    ).toBe('not_a_utf8_metric');
  });

  it('can render utf8 metric name in curly braces', () => {
    expect(
      modeller.renderQuery({
        metric: 'a.utf8.metric',
        labels: [],
        operations: [],
      })
    ).toBe('{"a.utf8.metric"}');
  });

  it('can render utf8 metric name in curly braces with legacy labels', () => {
    expect(
      modeller.renderQuery({
        metric: 'a.utf8.metric',
        labels: [
          {
            label: 'label',
            value: 'value',
            op: '=',
          },
        ],
        operations: [],
      })
    ).toBe('{"a.utf8.metric", label="value"}');
  });

  it('can render utf8 metric name in curly braces with legacy and utf8 labels', () => {
    expect(
      modeller.renderQuery({
        metric: 'a.utf8.metric',
        labels: [
          {
            label: 'label',
            value: 'value',
            op: '=',
          },
          {
            label: 'utf8.label',
            value: 'value',
            op: '=',
          },
        ],
        operations: [],
      })
    ).toBe('{"a.utf8.metric", label="value", "utf8.label"="value"}');
  });
});
