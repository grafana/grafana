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
          { id: LokiOperationId.Logfmt, params: [] },
        ],
      })
    );
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
          { id: LokiOperationId.Logfmt, params: [] },
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
          { id: LokiOperationId.Logfmt, params: [] },
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
          { id: LokiOperationId.Logfmt, params: [] },
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
          { id: LokiOperationId.Logfmt, params: [] },
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
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.Unwrap, params: ['label', 'duration'] },
          { id: LokiOperationId.SumOverTime, params: ['5m'] },
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
    expect(buildVisualQueryFromString('sum(rate({app="frontend"} | json [5m])) without(job,name)')).toEqual(
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
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.CountOverTime, params: ['5m'] },
          { id: LokiOperationId.Sum, params: [] },
          { id: LokiOperationId.TopK, params: [10] },
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
    expect(buildVisualQueryFromString('{app="frontend"} | label_format renameTo=original, bar=baz')).toEqual(
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
    expect(
      buildVisualQueryFromString('rate({project="bar"}[5m]) * 2 / rate({project="foo"}[5m]) + rate({app="test"}[1m])')
    ).toEqual(
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
    expect(buildVisualQueryFromString('{app="frontend"} | regexp ')).toEqual(
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
});

function noErrors(query: LokiVisualQuery) {
  return {
    errors: [],
    query,
  };
}
