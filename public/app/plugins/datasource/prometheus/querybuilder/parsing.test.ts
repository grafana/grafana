import { buildVisualQueryFromString } from './parsing';
import { PromVisualQuery } from './types';

describe('buildVisualQueryFromString', () => {
  it('creates no errors for empty query', () => {
    expect(buildVisualQueryFromString('')).toEqual(
      noErrors({
        labels: [],
        operations: [],
        metric: '',
      })
    );
  });
  it('parses simple query', () => {
    expect(buildVisualQueryFromString('counters_logins{app="frontend"}')).toEqual(
      noErrors({
        metric: 'counters_logins',
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [],
      })
    );
  });

  it('parses query with rate and interval', () => {
    expect(buildVisualQueryFromString('rate(counters_logins{app="frontend"}[5m])')).toEqual(
      noErrors({
        metric: 'counters_logins',
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          {
            id: 'rate',
            params: ['5m'],
          },
        ],
      })
    );
  });

  it('parses query with nested query and interval variable', () => {
    expect(
      buildVisualQueryFromString(
        'avg(rate(access_evaluation_duration_count{instance="host.docker.internal:3000"}[$__rate_interval]))'
      )
    ).toEqual({
      // after upgrading @prometheus-io/lezer-promql, strings containing global grafana variables such as $__rate_interval (https://grafana.com/docs/grafana/latest/variables/variable-types/global-variables/)
      // started returning error nodes upon parse, but the resultant tree was otherwise the same.
      // My assumption is that the newer version of lezer is more verbose in returning error nodes, and there should be no functional change to the parsed trees.
      errors: [
        {
          from: 107,
          parentType: 'MatrixSelector',
          text: '',
          to: 107,
        },
      ],
      query: {
        metric: 'access_evaluation_duration_count',
        labels: [
          {
            op: '=',
            value: 'host.docker.internal:3000',
            label: 'instance',
          },
        ],
        operations: [
          {
            id: 'rate',
            params: ['$__rate_interval'],
          },
          {
            id: 'avg',
            params: [],
          },
        ],
      },
    });
  });

  it('parses query with aggregation by labels', () => {
    const visQuery = {
      metric: 'metric_name',
      labels: [
        {
          label: 'instance',
          op: '=',
          value: 'internal:3000',
        },
      ],
      operations: [
        {
          id: '__sum_by',
          params: ['app', 'version'],
        },
      ],
    };
    expect(buildVisualQueryFromString('sum(metric_name{instance="internal:3000"}) by (app, version)')).toEqual(
      noErrors(visQuery)
    );
    expect(buildVisualQueryFromString('sum by (app, version)(metric_name{instance="internal:3000"})')).toEqual(
      noErrors(visQuery)
    );
  });

  it('parses query with aggregation without labels', () => {
    const visQuery = {
      metric: 'metric_name',
      labels: [
        {
          label: 'instance',
          op: '=',
          value: 'internal:3000',
        },
      ],
      operations: [
        {
          id: '__sum_without',
          params: ['app', 'version'],
        },
      ],
    };
    expect(buildVisualQueryFromString('sum(metric_name{instance="internal:3000"}) without (app, version)')).toEqual(
      noErrors(visQuery)
    );
    expect(buildVisualQueryFromString('sum without (app, version)(metric_name{instance="internal:3000"})')).toEqual(
      noErrors(visQuery)
    );
  });

  it('parses aggregation with params', () => {
    expect(buildVisualQueryFromString('topk(5, http_requests_total)')).toEqual(
      noErrors({
        metric: 'http_requests_total',
        labels: [],
        operations: [
          {
            id: 'topk',
            params: [5],
          },
        ],
      })
    );
  });

  it('parses aggregation with params and labels', () => {
    expect(buildVisualQueryFromString('topk by(instance, job) (5, http_requests_total)')).toEqual(
      noErrors({
        metric: 'http_requests_total',
        labels: [],
        operations: [
          {
            id: '__topk_by',
            params: [5, 'instance', 'job'],
          },
        ],
      })
    );
  });

  it('parses function with argument', () => {
    expect(
      buildVisualQueryFromString('histogram_quantile(0.99, rate(counters_logins{app="backend"}[$__rate_interval]))')
    ).toEqual({
      errors: [
        {
          from: 88,
          parentType: 'MatrixSelector',
          text: '',
          to: 88,
        },
      ],
      query: {
        metric: 'counters_logins',
        labels: [{ label: 'app', op: '=', value: 'backend' }],
        operations: [
          {
            id: 'rate',
            params: ['$__rate_interval'],
          },
          {
            id: 'histogram_quantile',
            params: [0.99],
          },
        ],
      },
    });
  });

  it('parses function with multiple arguments', () => {
    expect(
      buildVisualQueryFromString(
        'label_replace(avg_over_time(http_requests_total{instance="foo"}[$__interval]), "instance", "$1", "", "(.*)")'
      )
    ).toEqual({
      errors: [
        {
          from: 86,
          parentType: 'MatrixSelector',
          text: '',
          to: 86,
        },
      ],
      query: {
        metric: 'http_requests_total',
        labels: [{ label: 'instance', op: '=', value: 'foo' }],
        operations: [
          {
            id: 'avg_over_time',
            params: ['$__interval'],
          },
          {
            id: 'label_replace',
            params: ['instance', '$1', '', '(.*)'],
          },
        ],
      },
    });
  });

  it('parses binary operation with scalar', () => {
    expect(buildVisualQueryFromString('avg_over_time(http_requests_total{instance="foo"}[$__interval]) / 2')).toEqual({
      errors: [
        {
          from: 72,
          parentType: 'MatrixSelector',
          text: '',
          to: 72,
        },
      ],
      query: {
        metric: 'http_requests_total',
        labels: [{ label: 'instance', op: '=', value: 'foo' }],
        operations: [
          {
            id: 'avg_over_time',
            params: ['$__interval'],
          },
          {
            id: '__divide_by',
            params: [2],
          },
        ],
      },
    });
  });

  it('parses binary operation with 2 queries', () => {
    expect(
      buildVisualQueryFromString('avg_over_time(http_requests_total{instance="foo"}[$__interval]) / sum(logins_count)')
    ).toEqual({
      errors: [
        {
          from: 72,
          parentType: 'MatrixSelector',
          text: '',
          to: 72,
        },
      ],
      query: {
        metric: 'http_requests_total',
        labels: [{ label: 'instance', op: '=', value: 'foo' }],
        operations: [{ id: 'avg_over_time', params: ['$__interval'] }],
        binaryQueries: [
          {
            operator: '/',
            query: {
              metric: 'logins_count',
              labels: [],
              operations: [{ id: 'sum', params: [] }],
            },
          },
        ],
      },
    });
  });

  it('parses template variables in strings', () => {
    expect(buildVisualQueryFromString('http_requests_total{instance="$label_variable"}')).toEqual(
      noErrors({
        metric: 'http_requests_total',
        labels: [{ label: 'instance', op: '=', value: '$label_variable' }],
        operations: [],
      })
    );
  });

  it('parses template variables for metric', () => {
    expect(buildVisualQueryFromString('$metric_variable{instance="foo"}')).toEqual(
      noErrors({
        metric: '$metric_variable',
        labels: [{ label: 'instance', op: '=', value: 'foo' }],
        operations: [],
      })
    );

    expect(buildVisualQueryFromString('${metric_variable:fmt}{instance="foo"}')).toEqual(
      noErrors({
        metric: '${metric_variable:fmt}',
        labels: [{ label: 'instance', op: '=', value: 'foo' }],
        operations: [],
      })
    );

    expect(buildVisualQueryFromString('[[metric_variable:fmt]]{instance="foo"}')).toEqual(
      noErrors({
        metric: '[[metric_variable:fmt]]',
        labels: [{ label: 'instance', op: '=', value: 'foo' }],
        operations: [],
      })
    );
  });

  it('parses template variables in label name', () => {
    expect(buildVisualQueryFromString('metric{${variable_label}="foo"}')).toEqual(
      noErrors({
        metric: 'metric',
        labels: [{ label: '${variable_label}', op: '=', value: 'foo' }],
        operations: [],
      })
    );
  });

  it('fails to parse variable for function', () => {
    expect(buildVisualQueryFromString('${func_var}(metric{bar="foo"})')).toEqual({
      errors: [
        {
          text: '(',
          from: 20,
          to: 21,
          parentType: 'VectorSelector',
        },
        {
          text: 'metric',
          from: 21,
          to: 27,
          parentType: 'VectorSelector',
        },
      ],
      query: {
        metric: '${func_var}',
        labels: [{ label: 'bar', op: '=', value: 'foo' }],
        operations: [],
      },
    });
  });

  it('fails to parse malformed query', () => {
    expect(buildVisualQueryFromString('asdf-metric{bar="})')).toEqual({
      errors: [
        {
          text: '',
          from: 19,
          to: 19,
          parentType: 'LabelMatchers',
        },
      ],
      query: {
        metric: 'asdf',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '-',
            query: {
              metric: 'metric',
              labels: [{ label: 'bar', op: '=', value: '})' }],
              operations: [],
            },
          },
        ],
      },
    });
  });

  it('fails to parse malformed query 2', () => {
    expect(buildVisualQueryFromString('ewafweaf{afea=afe}')).toEqual({
      errors: [
        {
          text: 'afe}',
          from: 14,
          to: 18,
          parentType: 'LabelMatcher',
        },
      ],
      query: {
        metric: 'ewafweaf',
        labels: [{ label: 'afea', op: '=', value: '' }],
        operations: [],
      },
    });
  });

  it('parses query without metric', () => {
    expect(buildVisualQueryFromString('label_replace(rate([$__rate_interval]), "", "$1", "", "(.*)")')).toEqual({
      errors: [],
      query: {
        metric: '',
        labels: [],
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          {
            id: 'label_replace',
            params: ['', '$1', '', '(.*)'],
          },
        ],
      },
    });
  });

  it('lone aggregation without params', () => {
    expect(buildVisualQueryFromString('sum()')).toEqual({
      errors: [],
      query: {
        metric: '',
        labels: [],
        operations: [{ id: 'sum', params: [] }],
      },
    });
  });

  it('handles multiple binary scalar operations', () => {
    expect(buildVisualQueryFromString('cluster_namespace_slug_dialer_name + 1 - 1 / 1 * 1 % 1 ^ 1')).toEqual({
      errors: [],
      query: {
        metric: 'cluster_namespace_slug_dialer_name',
        labels: [],
        operations: [
          {
            id: '__addition',
            params: [1],
          },
          {
            id: '__subtraction',
            params: [1],
          },
          {
            id: '__divide_by',
            params: [1],
          },
          {
            id: '__multiply_by',
            params: [1],
          },
          {
            id: '__modulo',
            params: [1],
          },
          {
            id: '__exponent',
            params: [1],
          },
        ],
      },
    });
  });

  it('handles scalar comparison operators', () => {
    expect(buildVisualQueryFromString('cluster_namespace_slug_dialer_name <= 2.5')).toEqual({
      errors: [],
      query: {
        metric: 'cluster_namespace_slug_dialer_name',
        labels: [],
        operations: [
          {
            id: '__less_or_equal',
            params: [2.5, false],
          },
        ],
      },
    });
  });

  it('handles bool with comparison operator', () => {
    expect(buildVisualQueryFromString('cluster_namespace_slug_dialer_name <= bool 2')).toEqual({
      errors: [],
      query: {
        metric: 'cluster_namespace_slug_dialer_name',
        labels: [],
        operations: [
          {
            id: '__less_or_equal',
            params: [2, true],
          },
        ],
      },
    });
  });

  it('handles multiple binary operations', () => {
    expect(buildVisualQueryFromString('foo{x="yy"} * metric{y="zz",a="bb"} * metric2')).toEqual({
      errors: [],
      query: {
        metric: 'foo',
        labels: [{ label: 'x', op: '=', value: 'yy' }],
        operations: [],
        binaryQueries: [
          {
            operator: '*',
            query: {
              metric: 'metric',
              labels: [
                { label: 'y', op: '=', value: 'zz' },
                { label: 'a', op: '=', value: 'bb' },
              ],
              operations: [],
            },
          },
          {
            operator: '*',
            query: {
              metric: 'metric2',
              labels: [],
              operations: [],
            },
          },
        ],
      },
    });
  });

  it('handles multiple binary operations and scalar', () => {
    expect(buildVisualQueryFromString('foo{x="yy"} * metric{y="zz",a="bb"} * 2')).toEqual({
      errors: [],
      query: {
        metric: 'foo',
        labels: [{ label: 'x', op: '=', value: 'yy' }],
        operations: [
          {
            id: '__multiply_by',
            params: [2],
          },
        ],
        binaryQueries: [
          {
            operator: '*',
            query: {
              metric: 'metric',
              labels: [
                { label: 'y', op: '=', value: 'zz' },
                { label: 'a', op: '=', value: 'bb' },
              ],
              operations: [],
            },
          },
        ],
      },
    });
  });

  it('handles binary operation with vector matchers', () => {
    expect(buildVisualQueryFromString('foo * on(foo, bar) metric')).toEqual({
      errors: [],
      query: {
        metric: 'foo',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '*',
            vectorMatches: 'foo, bar',
            vectorMatchesType: 'on',
            query: { metric: 'metric', labels: [], operations: [] },
          },
        ],
      },
    });

    expect(buildVisualQueryFromString('foo * ignoring(foo) metric')).toEqual({
      errors: [],
      query: {
        metric: 'foo',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '*',
            vectorMatches: 'foo',
            vectorMatchesType: 'ignoring',
            query: { metric: 'metric', labels: [], operations: [] },
          },
        ],
      },
    });
  });

  it('reports error on parenthesis', () => {
    expect(buildVisualQueryFromString('foo / (bar + baz)')).toEqual({
      errors: [
        {
          from: 6,
          parentType: 'Expr',
          text: '(bar + baz)',
          to: 17,
        },
      ],
      query: {
        metric: 'foo',
        labels: [],
        operations: [],
        binaryQueries: [
          {
            operator: '/',
            query: {
              binaryQueries: [{ operator: '+', query: { labels: [], metric: 'baz', operations: [] } }],
              metric: 'bar',
              labels: [],
              operations: [],
            },
          },
        ],
      },
    });
  });
});

function noErrors(query: PromVisualQuery) {
  return {
    errors: [],
    query,
  };
}
