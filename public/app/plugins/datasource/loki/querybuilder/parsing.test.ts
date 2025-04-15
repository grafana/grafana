import { buildVisualQueryFromString } from './parsing';
import { LokiOperationId, LokiVisualQuery } from './types';

describe('buildVisualQueryFromString', () => {
  it('creates no errors for empty query', () => {
    expect(buildVisualQueryFromString('')).toEqual(
      noErrors({
        labels: [],
        operations: [],
      })
    );
  });

  it('parses simple binary comparison', () => {
    expect(buildVisualQueryFromString('count_over_time({app="aggregator"} [$__auto]) == 11')).toEqual({
      query: {
        labels: [
          {
            label: 'app',
            op: '=',
            value: 'aggregator',
          },
        ],
        operations: [
          {
            id: LokiOperationId.CountOverTime,
            params: ['$__auto'],
          },
          {
            id: LokiOperationId.EqualTo,
            // defined in getSimpleBinaryRenderer, the first argument is the bool value, and the second is the comparison operator
            params: [11, false],
          },
        ],
      },
      errors: [],
    });
  });

  // This still fails because loki doesn't properly parse the bool operator
  it('parses simple query with label-values with boolean operator', () => {
    expect(buildVisualQueryFromString('count_over_time({app="aggregator"} [$__auto]) == bool 12')).toEqual({
      query: {
        labels: [
          {
            label: 'app',
            op: '=',
            value: 'aggregator',
          },
        ],
        operations: [
          {
            id: LokiOperationId.CountOverTime,
            params: ['$__auto'],
          },
          {
            id: LokiOperationId.EqualTo,
            // defined in getSimpleBinaryRenderer, the first argument is the bool value, and the second is the comparison operator
            params: [12, true],
          },
        ],
      },
      errors: [],
    });
  });

  it('parses binary operation with query', () => {
    expect(
      // There is no capability for "bool" in the query builder for (nested) binary operation with query as of now, it will always be stripped out
      buildVisualQueryFromString(
        'max by(stream) (count_over_time({app="aggregator"}[1m])) > bool ignoring(stream) avg(count_over_time({app="aggregator"}[1m]))'
      )
    ).toEqual({
      query: {
        binaryQueries: [
          {
            // nested binary operation
            operator: '>',
            query: {
              labels: [
                {
                  label: 'app',
                  op: '=',
                  value: 'aggregator',
                },
              ],
              operations: [
                {
                  id: 'count_over_time',
                  params: ['1m'],
                },
                {
                  id: 'avg',
                  params: [],
                },
              ],
            },
            vectorMatches: 'stream',
            vectorMatchesType: 'ignoring',
          },
        ],
        labels: [
          {
            label: 'app',
            op: '=',
            value: 'aggregator',
          },
        ],
        operations: [
          {
            id: 'count_over_time',
            params: ['1m'],
          },
          {
            id: '__max_by',
            params: ['stream'],
          },
        ],
      },
      errors: [],
    });
  });

  it('parses simple query with label-values', () => {
    expect(buildVisualQueryFromString('{app="frontend"}')).toEqual(
      noErrors({
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

  it('parses query with multiple label-values pairs', () => {
    expect(buildVisualQueryFromString('{app="frontend", instance!="1"}')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
          {
            op: '!=',
            value: '1',
            label: 'instance',
          },
        ],
        operations: [],
      })
    );
  });

  it('parses query with line filter', () => {
    expect(buildVisualQueryFromString('{app="frontend"} |= "line"')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LineContains, params: ['line'] }],
      })
    );
  });

  it.each([
    ['|=', LokiOperationId.LineContains],
    ['!=', LokiOperationId.LineContainsNot],
    ['|~', LokiOperationId.LineMatchesRegex],
    ['!~', LokiOperationId.LineMatchesRegexNot],
  ])('parses query with line filter and `or` statements', (op: string, id: LokiOperationId) => {
    expect(buildVisualQueryFromString(`{app="frontend"} ${op} "line" or "text"`)).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id, params: ['line', 'text'] }],
      })
    );
  });

  it('parses query with line filters and escaped characters', () => {
    expect(buildVisualQueryFromString('{app="frontend"} |= "\\\\line"')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LineContains, params: ['\\line'] }],
      })
    );
  });

  it('parses query with line filter and escaped quote', () => {
    expect(buildVisualQueryFromString('{app="frontend"} |= "\\"line"')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LineContains, params: ['"line'] }],
      })
    );
  });

  it('parses query with label filter and escaped quote', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | bar="\\"baz"')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LabelFilter, params: ['bar', '=', '"baz'] }],
      })
    );
  });

  it('returns error for query with ip matching line filter', () => {
    const context = buildVisualQueryFromString('{app="frontend"} |= ip("192.168.4.5/16") | logfmt');
    expect(context).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.LineFilterIpMatches, params: ['|=', '192.168.4.5/16'] },
          { id: LokiOperationId.Logfmt, params: [false, false] },
        ],
      })
    );
  });

  it('returns error when parsing ambiguous query', () => {
    //becomes topk(5, count_over_time({app="aggregator"} [1m])) / count_over_time({cluster="dev-eu-west-2"} [1m])
    const context = buildVisualQueryFromString(
      'topk(5,count_over_time({app="aggregator"}[1m])/count_over_time({cluster="dev-eu-west-2"}[1m]))'
    );
    expect(context).toMatchObject({
      errors: [
        {
          from: 7,
          text: 'Query parsing is ambiguous.',
          to: 93,
        },
      ],
    });
  });

  it('parses query with matcher label filter', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | bar="baz"')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LabelFilter, params: ['bar', '=', 'baz'] }],
      })
    );
  });

  it('parses query with number label filter', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | bar >= 8')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LabelFilter, params: ['bar', '>=', '8'] }],
      })
    );
  });

  it('parses query with no pipe errors filter', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | __error__=""')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LabelFilterNoErrors, params: [] }],
      })
    );
  });

  it('parses query with with unit label filter', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | bar < 8m')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LabelFilter, params: ['bar', '<', '8m'] }],
      })
    );
  });

  it('returns error for query with "and", "or", "comma" in label filter', () => {
    const context = buildVisualQueryFromString('{app="frontend"} | logfmt | level="error" and job="grafana"');
    expect(context.errors).toEqual([
      {
        text: 'Label filter with comma, "and", "or" not supported in query builder: level="error" and job="grafana"',
        from: 28,
        to: 59,
        parentType: 'PipelineStage',
      },
    ]);
  });

  it('returns error for query with ip label filter', () => {
    const context = buildVisualQueryFromString('{app="frontend"} | logfmt | address=ip("192.168.4.5/16")');
    expect(context).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Logfmt, params: [false, false] },
          { id: LokiOperationId.LabelFilterIpMatches, params: ['address', '=', '192.168.4.5/16'] },
        ],
      })
    );
  });

  it('parses query with with parser', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | json')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Json, params: [] }],
      })
    );
  });

  it('parses query with JSON parser with expression', () => {
    const context = buildVisualQueryFromString('{app="frontend"} | json label="value" ');
    expect(context.query).toEqual({
      labels: [{ label: 'app', op: '=', value: 'frontend' }],
      operations: [{ id: LokiOperationId.Json, params: ['label="value"'] }],
    });
  });

  it('parses query with JSON parser with multiple expressions', () => {
    const context = buildVisualQueryFromString('{app="frontend"} | json label="value", bar="baz", foo="bar" ');
    expect(context.query).toEqual({
      labels: [{ label: 'app', op: '=', value: 'frontend' }],
      operations: [{ id: LokiOperationId.Json, params: ['label="value"', 'bar="baz"', 'foo="bar"'] }],
    });
  });

  it('parses query with with simple unwrap', () => {
    expect(
      buildVisualQueryFromString('sum_over_time({app="frontend"} | logfmt | unwrap bytes_processed [1m])')
    ).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Logfmt, params: [false, false] },
          { id: LokiOperationId.Unwrap, params: ['bytes_processed', ''] },
          { id: LokiOperationId.SumOverTime, params: ['1m'] },
        ],
      })
    );
  });

  it('parses query with with unwrap and error filter', () => {
    expect(
      buildVisualQueryFromString('sum_over_time({app="frontend"} | logfmt | unwrap duration | __error__="" [1m])')
    ).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Logfmt, params: [false, false] },
          { id: LokiOperationId.Unwrap, params: ['duration', ''] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.SumOverTime, params: ['1m'] },
        ],
      })
    );
  });

  it('parses query with with unwrap and label filter', () => {
    expect(
      buildVisualQueryFromString('sum_over_time({app="frontend"} | logfmt | unwrap duration | label="value" [1m])')
    ).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Logfmt, params: [false, false] },
          { id: LokiOperationId.Unwrap, params: ['duration', ''] },
          { id: LokiOperationId.LabelFilter, params: ['label', '=', 'value'] },
          { id: LokiOperationId.SumOverTime, params: ['1m'] },
        ],
      })
    );
  });

  it('parses query with unwrap and conversion function', () => {
    const context = buildVisualQueryFromString(
      'sum_over_time({app="frontend"} | logfmt | unwrap duration(label) [5m])'
    );
    expect(context).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Logfmt, params: [false, false] },
          { id: LokiOperationId.Unwrap, params: ['label', 'duration'] },
          { id: LokiOperationId.SumOverTime, params: ['5m'] },
        ],
      })
    );
  });

  it('parses query with with only decolorize', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | decolorize')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Decolorize, params: [] }],
      })
    );
  });

  it('parses query with with decolorize and other operations', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | logfmt | decolorize | __error__=""')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Logfmt, params: [false, false] },
          { id: LokiOperationId.Decolorize, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
        ],
      })
    );
  });

  it('parses metrics query with function', () => {
    expect(buildVisualQueryFromString('rate({app="frontend"} | json [5m])')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.Rate, params: ['5m'] },
        ],
      })
    );
  });

  it('parses metrics query with function and aggregation', () => {
    expect(buildVisualQueryFromString('sum(rate({app="frontend"} | json [5m]))')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.Rate, params: ['5m'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      })
    );
  });

  it('parses metrics query with function and aggregation with grouping', () => {
    expect(buildVisualQueryFromString('sum by (job,name) (rate({app="frontend"} | json [5m]))')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.Rate, params: ['5m'] },
          { id: LokiOperationId.SumBy, params: ['job', 'name'] },
        ],
      })
    );
  });

  it('parses metrics query with function and aggregation with grouping at the end', () => {
    const expression = 'sum(rate({app="frontend"} | json [5m])) without(job,name)';
    expect(buildVisualQueryFromString(expression)).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.Rate, params: ['5m'] },
          { id: LokiOperationId.SumWithout, params: ['job', 'name'] },
        ],
      })
    );
  });

  it('parses metrics query with function and aggregation and filters', () => {
    expect(buildVisualQueryFromString('sum(rate({app="frontend"} |~ `abc` | json | bar="baz" [5m]))')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.LineMatchesRegex, params: ['abc'] },
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.LabelFilter, params: ['bar', '=', 'baz'] },
          { id: LokiOperationId.Rate, params: ['5m'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      })
    );
  });

  it('parses metrics query with vector aggregation with number', () => {
    expect(
      buildVisualQueryFromString('topk(10, sum(count_over_time({app="frontend"} | logfmt | __error__=`` [5m])))')
    ).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.Logfmt, params: [false, false] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.CountOverTime, params: ['5m'] },
          { id: LokiOperationId.Sum, params: [] },
          { id: LokiOperationId.TopK, params: [10] },
        ],
      })
    );
  });

  it('parses metrics query with vector aggregation with variable', () => {
    expect(
      buildVisualQueryFromString('topk($variable, sum by(unit) (count_over_time({app="frontend"}[$__auto])))')
    ).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.CountOverTime, params: ['$__auto'] },
          { id: LokiOperationId.SumBy, params: ['unit'] },
          { id: LokiOperationId.TopK, params: ['$variable'] },
        ],
      })
    );
  });

  it('parses template variables in strings', () => {
    expect(buildVisualQueryFromString('{instance="$label_variable"}')).toEqual(
      noErrors({
        labels: [{ label: 'instance', op: '=', value: '$label_variable' }],
        operations: [],
      })
    );
  });

  it('parses metrics query with interval variables', () => {
    expect(buildVisualQueryFromString('rate({app="frontend"} [$__interval])')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Rate, params: ['$__interval'] }],
      })
    );
  });

  it('parses quantile queries', () => {
    expect(buildVisualQueryFromString(`quantile_over_time(0.99, {app="frontend"} [1m])`)).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.QuantileOverTime, params: ['1m', '0.99'] }],
      })
    );
  });

  it('parses quantile queries with grouping', () => {
    expect(buildVisualQueryFromString(`quantile_over_time(0.99, {app="frontend"} [1m]) by (host1, host2)`)).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.QuantileOverTime, params: ['1m', '0.99', 'host1', 'host2'] }],
      })
    );
  });

  it('parses query with line format', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | line_format "abc"')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LineFormat, params: ['abc'] }],
      })
    );
  });

  it('parses query with label format', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | label_format renameTo=original')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.LabelFormat, params: ['original', 'renameTo'] }],
      })
    );
  });

  it('parses query with multiple label format', () => {
    // Converted to {app="frontend"} | label_format renameTo=original | label_format bar=baz by visual query builder
    const expression = '{app="frontend"} | label_format renameTo=original, bar=baz';
    expect(buildVisualQueryFromString(expression)).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [
          { id: LokiOperationId.LabelFormat, params: ['original', 'renameTo'] },
          { id: LokiOperationId.LabelFormat, params: ['baz', 'bar'] },
        ],
      })
    );
  });

  it('parses binary query', () => {
    expect(buildVisualQueryFromString('rate({project="bar"}[5m]) / rate({project="foo"}[5m])')).toEqual(
      noErrors({
        labels: [{ op: '=', value: 'bar', label: 'project' }],
        operations: [{ id: LokiOperationId.Rate, params: ['5m'] }],
        binaryQueries: [
          {
            operator: '/',
            query: {
              labels: [{ op: '=', value: 'foo', label: 'project' }],
              operations: [{ id: LokiOperationId.Rate, params: ['5m'] }],
            },
          },
        ],
      })
    );
  });

  it('parses binary scalar query', () => {
    expect(buildVisualQueryFromString('rate({project="bar"}[5m]) / 2')).toEqual(
      noErrors({
        labels: [{ op: '=', value: 'bar', label: 'project' }],
        operations: [
          { id: LokiOperationId.Rate, params: ['5m'] },
          { id: LokiOperationId.DivideBy, params: [2] },
        ],
      })
    );
  });

  it('parses chained binary query', () => {
    const expression = 'rate({project="bar"}[5m]) * 2 / rate({project="foo"}[5m]) + rate({app="test"}[1m])';
    // is converted to (rate({project="bar"} [5m]) * 2) / (rate({project="foo"} [5m]) + rate({app="test"} [1m])) by visual query builder
    // Note the extra parenthesis around the first binary operation expression: (rate({project="bar"} [5m]) * 2)
    expect(buildVisualQueryFromString(expression)).toEqual(
      noErrors({
        labels: [{ op: '=', value: 'bar', label: 'project' }],
        operations: [
          { id: LokiOperationId.Rate, params: ['5m'] },
          { id: LokiOperationId.MultiplyBy, params: [2] },
        ],
        binaryQueries: [
          {
            operator: '/',
            query: {
              labels: [{ op: '=', value: 'foo', label: 'project' }],
              operations: [{ id: LokiOperationId.Rate, params: ['5m'] }],
              binaryQueries: [
                {
                  operator: '+',
                  query: {
                    labels: [{ op: '=', value: 'test', label: 'app' }],
                    operations: [{ id: LokiOperationId.Rate, params: ['1m'] }],
                  },
                },
              ],
            },
          },
        ],
      })
    );
  });

  it('parses simple query with quotes in label value', () => {
    expect(buildVisualQueryFromString('{app="\\"frontend\\""}')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: '\\"frontend\\"',
            label: 'app',
          },
        ],
        operations: [],
      })
    );
  });

  it('parses a regexp with empty string param', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | regexp "" ')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Regexp, params: [''] }],
      })
    );
  });

  it('parses a regexp with no param', () => {
    const expression = '{app="frontend"} | regexp ';
    // Converted to {app="frontend"} | regexp `` by visual query builder
    expect(buildVisualQueryFromString(expression)).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Regexp, params: [''] }],
      })
    );
  });

  it('parses a pattern with empty string param', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | pattern "" ')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Pattern, params: [''] }],
      })
    );
  });

  it('parses a pattern with no param', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | pattern ')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Pattern, params: [''] }],
      })
    );
  });

  it('parses a json with no param', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | json ')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Json, params: [] }],
      })
    );
  });

  it.each(['$__interval', '5m'])('parses query range with unwrap and regex', (range) => {
    expect(
      buildVisualQueryFromString(
        'avg_over_time({test="value"} |= `restart counter is at` | regexp `restart counter is at (?P<restart_counter>[0-9]+)s*.*.*?$` | unwrap restart_counter [' +
          range +
          '])'
      )
    ).toEqual({
      errors: [],
      query: {
        labels: [{ label: 'test', op: '=', value: 'value' }],
        operations: [
          { id: '__line_contains', params: ['restart counter is at'] },
          { id: 'regexp', params: ['restart counter is at (?P<restart_counter>[0-9]+)s*.*.*?$'] },
          { id: 'unwrap', params: ['restart_counter', ''] },
          { id: 'avg_over_time', params: [range] },
        ],
      },
    });
  });

  it('parses a log query with drop and no labels', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | drop')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Drop, params: [] }],
      })
    );
  });

  it('parses a log query with drop and labels', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | drop id, email')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Drop, params: ['id', 'email'] }],
      })
    );
  });

  it('parses a log query with drop, labels and expressions', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | drop id, email, test="test1"')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Drop, params: ['id', 'email', 'test="test1"'] }],
      })
    );
  });

  it('parses a log query with keep and no labels', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | keep')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Keep, params: [] }],
      })
    );
  });

  it('parses a log query with keep and labels', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | keep id, email')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Keep, params: ['id', 'email'] }],
      })
    );
  });

  it('parses a log query with keep, labels and expressions', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | keep id, email, test="test1"')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: LokiOperationId.Keep, params: ['id', 'email', 'test="test1"'] }],
      })
    );
  });

  it('parses query with logfmt parser', () => {
    expect(buildVisualQueryFromString('{label="value"} | logfmt')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'value',
            label: 'label',
          },
        ],
        operations: [{ id: LokiOperationId.Logfmt, params: [false, false] }],
      })
    );
  });

  it('parses query with logfmt parser and flags', () => {
    expect(buildVisualQueryFromString('{label="value"} | logfmt --keep-empty --strict')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'value',
            label: 'label',
          },
        ],
        operations: [{ id: LokiOperationId.Logfmt, params: [true, true] }],
      })
    );
  });

  it('parses query with logfmt parser, flags, and labels', () => {
    expect(
      buildVisualQueryFromString('{label="value"} | logfmt --keep-empty --strict label1, label2, label3="label4"')
    ).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'value',
            label: 'label',
          },
        ],
        operations: [{ id: LokiOperationId.Logfmt, params: [true, true, 'label1', 'label2', 'label3="label4"'] }],
      })
    );
  });
});

function noErrors(query: LokiVisualQuery) {
  return {
    errors: [],
    query,
  };
}
