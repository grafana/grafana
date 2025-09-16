// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/parsing.test.ts
import { buildVisualQueryFromString } from './parsing';
import { PromOperationId, PromVisualQuery } from './types';

describe('buildVisualQueryFromString', () => {
  describe('info function support', () => {
    // Currently, the visual query editor throws an error when parsing the 'info' function
    // because this function is only supported in code mode.
    // TODO: When visual query editor support for the 'info' function is implemented,
    // this test should be updated to expect successful parsing instead of an error.
    it('should throw error when trying to parse info function', () => {
      expect(
        buildVisualQueryFromString(
          'sum by (cluster, sdk_language) ( info( rate(server_req_dur_sec_count{instance="the-instance"}[2m]), {sdk_language="go"} ) )'
        )
      ).toEqual({
        query: {
          labels: [
            {
              label: 'instance',
              op: '=',
              value: 'the-instance',
            },
            {
              label: 'sdk_language',
              op: '=',
              value: 'go',
            },
          ],
          metric: 'server_req_dur_sec_count',
          operations: [
            {
              id: 'rate',
              params: ['2m'],
            },
            {
              id: 'info',
              params: [],
            },
            {
              id: '__sum_by',
              params: ['cluster', 'sdk_language'],
            },
          ],
        },
        errors: [
          {
            from: 33,
            text: 'Query parsing is ambiguous.',
            to: 121,
          },
        ],
      });
    });
  });

  describe('utf8 support', () => {
    it('supports uts-8 label names', () => {
      expect(buildVisualQueryFromString('{"glück:🍀.dot"="luck"} == 11')).toEqual({
        query: {
          labels: [
            {
              label: 'glück:🍀.dot',
              op: '=',
              value: 'luck',
            },
          ],
          metric: '',
          operations: [
            {
              id: PromOperationId.EqualTo,
              params: [11, false],
            },
          ],
        },
        errors: [],
      });
    });

    it('supports uts-8 metric names', () => {
      expect(buildVisualQueryFromString('{"I am a metric"}')).toEqual({
        query: {
          labels: [],
          metric: 'I am a metric',
          operations: [],
        },
        errors: [],
      });
    });

    it('supports uts-8 metric names with labels', () => {
      expect(buildVisualQueryFromString('{"metric.name", label_field="label value"}')).toEqual({
        query: {
          labels: [
            {
              label: 'label_field',
              op: '=',
              value: 'label value',
            },
          ],
          metric: 'metric.name',
          operations: [],
        },
        errors: [],
      });
    });

    it('supports uts-8 metric names with utf8 labels', () => {
      expect(buildVisualQueryFromString('{"metric.name", "glück:🍀.dot"="luck"} == 11')).toEqual({
        query: {
          labels: [
            {
              label: 'glück:🍀.dot',
              op: '=',
              value: 'luck',
            },
          ],
          metric: 'metric.name',
          operations: [
            {
              id: PromOperationId.EqualTo,
              params: [11, false],
            },
          ],
        },
        errors: [],
      });
    });
  });

  it('creates no errors for empty query', () => {
    expect(buildVisualQueryFromString('')).toEqual(
      noErrors({
        labels: [],
        operations: [],
        metric: '',
      })
    );
  });

  it('parses simple binary comparison', () => {
    expect(buildVisualQueryFromString('{app="aggregator"} == 11')).toEqual({
      query: {
        labels: [
          {
            label: 'app',
            op: '=',
            value: 'aggregator',
          },
        ],
        metric: '',
        operations: [
          {
            id: PromOperationId.EqualTo,
            params: [11, false],
          },
        ],
      },
      errors: [],
    });
  });

  // This still fails because loki doesn't properly parse the bool operator
  it('parses simple query with with boolean operator', () => {
    expect(buildVisualQueryFromString('{app="aggregator"} == bool 12')).toEqual({
      query: {
        labels: [
          {
            label: 'app',
            op: '=',
            value: 'aggregator',
          },
        ],
        metric: '',
        operations: [
          {
            id: PromOperationId.EqualTo,
            params: [12, true],
          },
        ],
      },
      errors: [],
    });
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

  describe('nested binary operation errors in visual query editor', () => {
    // Visual query builder does not currently have support for nested binary operations, for now we should throw an error in the UI letting users know that their query will be misinterpreted
    it('throws error when visual query parse is ambiguous', () => {
      expect(
        buildVisualQueryFromString('topk(5, node_arp_entries / node_arp_entries{cluster="dev-eu-west-2"})')
      ).toMatchObject({
        errors: [
          {
            from: 8,
            text: 'Query parsing is ambiguous.',
            to: 68,
          },
        ],
      });
    });

    it('throws error when visual query parse with aggregation is ambiguous (scalar)', () => {
      expect(buildVisualQueryFromString('topk(5, 1 / 2)')).toMatchObject({
        errors: [
          {
            from: 8,
            text: 'Query parsing is ambiguous.',
            to: 13,
          },
        ],
      });
    });

    it('throws error when visual query parse with functionCall is ambiguous', () => {
      expect(
        buildVisualQueryFromString(
          'clamp_min(sum by(cluster)(rate(X{le="2.5"}[5m]))+sum by (cluster) (rate(X{le="5"}[5m])), 0.001)'
        )
      ).toMatchObject({
        errors: [
          {
            from: 10,
            text: 'Query parsing is ambiguous.',
            to: 87,
          },
        ],
      });
    });

    it('does not throw error when visual query parse is unambiguous', () => {
      expect(
        buildVisualQueryFromString('topk(5, node_arp_entries) / node_arp_entries{cluster="dev-eu-west-2"}')
      ).toMatchObject({
        errors: [],
      });
    });

    it('does not throw error when visual query parse is unambiguous (scalar)', () => {
      // Note this topk query with scalars is not valid in prometheus, but it does not currently throw an error during parse
      expect(buildVisualQueryFromString('topk(5, 1) / 2')).toMatchObject({
        errors: [],
      });
    });

    it('does not throw error when visual query parse is unambiguous, function call', () => {
      // Note this topk query with scalars is not valid in prometheus, but it does not currently throw an error during parse
      expect(
        buildVisualQueryFromString(
          'clamp_min(sum by(cluster) (rate(X{le="2.5"}[5m])), 0.001) + sum by(cluster) (rate(X{le="5"}[5m]))'
        )
      ).toMatchObject({
        errors: [],
      });
    });
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
      errors: [],
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

  it('parses query with aggregation by utf8 labels', () => {
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
          params: ['cluster', '"app.version"'],
        },
      ],
    };
    expect(
      buildVisualQueryFromString('sum(metric_name{instance="internal:3000"}) by ("app.version", cluster)')
    ).toEqual(noErrors(visQuery));
    expect(
      buildVisualQueryFromString('sum by ("app.version", cluster)(metric_name{instance="internal:3000"})')
    ).toEqual(noErrors(visQuery));
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
      errors: [],
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

  it('parses a native histogram function correctly', () => {
    expect(
      buildVisualQueryFromString('histogram_count(rate(counters_logins{app="backend"}[$__rate_interval]))')
    ).toEqual({
      errors: [],
      query: {
        metric: 'counters_logins',
        labels: [{ label: 'app', op: '=', value: 'backend' }],
        operations: [
          {
            id: 'rate',
            params: ['$__rate_interval'],
          },
          {
            id: 'histogram_count',
            params: [],
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
      errors: [],
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
      errors: [],
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
      errors: [],
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

  it('Throws error when undefined', () => {
    expect(() => buildVisualQueryFromString(undefined as unknown as string)).toThrow(
      "Cannot read properties of undefined (reading 'replace')"
    );
  });

  it('Works with empty string', () => {
    expect(buildVisualQueryFromString('')).toEqual(
      noErrors({
        metric: '',
        labels: [],
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
        {
          text: ')',
          from: 38,
          to: 39,
          parentType: 'PromQL',
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
          parentType: 'UnquotedLabelMatcher',
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
          parentType: 'BinaryExpr',
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

  it('strips enclosing quotes', () => {
    expect(buildVisualQueryFromString("counters_logins{app='frontend', host=`localhost`}")).toEqual(
      noErrors({
        metric: 'counters_logins',
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
          {
            op: '=',
            value: 'localhost',
            label: 'host',
          },
        ],
        operations: [],
      })
    );
  });

  it('leaves escaped quotes inside string', () => {
    expect(buildVisualQueryFromString('counters_logins{app="fron\\"\\"tend"}')).toEqual(
      noErrors({
        metric: 'counters_logins',
        labels: [
          {
            op: '=',
            value: 'fron\\"\\"tend',
            label: 'app',
          },
        ],
        operations: [],
      })
    );
  });

  it('parses the group function as an aggregation', () => {
    expect(buildVisualQueryFromString('group by (job) (go_goroutines)')).toEqual(
      noErrors({
        metric: 'go_goroutines',
        labels: [],
        operations: [
          {
            id: '__group_by',
            params: ['job'],
          },
        ],
      })
    );
  });

  it('parses query with custom variable', () => {
    expect(buildVisualQueryFromString('topk($custom, rate(metric_name[$__rate_interval]))')).toEqual(
      noErrors({
        metric: 'metric_name',
        labels: [],
        operations: [
          {
            id: 'rate',
            params: ['$__rate_interval'],
          },
          {
            id: 'topk',
            params: ['$custom'],
          },
        ],
      })
    );
  });
});

function noErrors(query: PromVisualQuery) {
  return {
    errors: [],
    query,
  };
}
