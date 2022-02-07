import { buildVisualQueryFromString } from './parsing';
import { PromVisualQuery } from './types';

describe('buildVisualQueryFromString', () => {
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
    ).toEqual(
      noErrors({
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
      })
    );
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

  it('parses function with multiple arguments', () => {
    expect(
      buildVisualQueryFromString(
        'label_replace(avg_over_time(http_requests_total{instance="foo"}[$__interval]), "instance", "$1", "", "(.*)")'
      )
    ).toEqual(
      noErrors({
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
      })
    );
  });

  it('parses binary operation with scalar', () => {
    expect(buildVisualQueryFromString('avg_over_time(http_requests_total{instance="foo"}[$__interval]) / 2')).toEqual(
      noErrors({
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
      })
    );
  });

  it('parses binary operation with 2 queries', () => {
    expect(
      buildVisualQueryFromString('avg_over_time(http_requests_total{instance="foo"}[$__interval]) / sum(logins_count)')
    ).toEqual(
      noErrors({
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
      })
    );
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
});

function noErrors(query: PromVisualQuery) {
  return {
    errors: [],
    query,
  };
}
