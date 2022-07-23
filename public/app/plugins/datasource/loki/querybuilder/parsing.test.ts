import { buildVisualQueryFromString } from './parsing';
import { LokiVisualQuery } from './types';

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
        operations: [{ id: '__line_contains', params: ['line'] }],
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
        operations: [{ id: '__line_contains', params: ['\\line'] }],
      })
    );
  });

  it('returns error for query with ip matching line filter', () => {
    const context = buildVisualQueryFromString('{app="frontend"} |= ip("192.168.4.5/16")');
    expect(context.errors).toEqual([
      {
        text: 'Matching ip addresses not supported in query builder: |= ip("192.168.4.5/16")',
        from: 17,
        to: 40,
        parentType: 'LineFilters',
      },
    ]);
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
        operations: [{ id: '__label_filter', params: ['bar', '=', 'baz'] }],
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
        operations: [{ id: '__label_filter', params: ['bar', '>=', '8'] }],
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
        operations: [{ id: '__label_filter_no_errors', params: [] }],
      })
    );
  });

  it('parses query with with unit label filter', () => {
    expect(buildVisualQueryFromString('{app="frontend"} | bar < 8mb')).toEqual(
      noErrors({
        labels: [
          {
            op: '=',
            value: 'frontend',
            label: 'app',
          },
        ],
        operations: [{ id: '__label_filter', params: ['bar', '<', '8mb'] }],
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
    expect(context.errors).toEqual([
      {
        text: 'IpLabelFilter not supported in query builder: address=ip("192.168.4.5/16")',
        from: 28,
        to: 56,
        parentType: 'PipelineStage',
      },
    ]);
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
        operations: [{ id: 'json', params: [] }],
      })
    );
  });

  it('parses query with JSON parser with expression', () => {
    const context = buildVisualQueryFromString('{app="frontend"} | json label="value" ');
    expect(context.query).toEqual({
      labels: [{ label: 'app', op: '=', value: 'frontend' }],
      operations: [{ id: 'json', params: ['label="value"'] }],
    });
  });

  it('parses query with JSON parser with multiple expressions', () => {
    const context = buildVisualQueryFromString('{app="frontend"} | json label="value", bar="baz", foo="bar" ');
    expect(context.query).toEqual({
      labels: [{ label: 'app', op: '=', value: 'frontend' }],
      operations: [{ id: 'json', params: ['label="value"', 'bar="baz"', 'foo="bar"'] }],
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
          { id: 'logfmt', params: [] },
          { id: 'unwrap', params: ['bytes_processed'] },
          { id: 'sum_over_time', params: ['1m'] },
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
          { id: 'logfmt', params: [] },
          { id: 'unwrap', params: ['duration'] },
          { id: '__label_filter_no_errors', params: [] },
          { id: 'sum_over_time', params: ['1m'] },
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
          { id: 'logfmt', params: [] },
          { id: 'unwrap', params: ['duration'] },
          { id: '__label_filter', params: ['label', '=', 'value'] },
          { id: 'sum_over_time', params: ['1m'] },
        ],
      })
    );
  });

  it('returns error for query with unwrap and conversion operation', () => {
    const context = buildVisualQueryFromString(
      'sum_over_time({app="frontend"} | logfmt | unwrap duration(label) [5m])'
    );
    expect(context.errors).toEqual([
      {
        text: 'Unwrap with conversion operator not supported in query builder: | unwrap duration(label)',
        from: 40,
        to: 64,
        parentType: 'LogRangeExpr',
      },
    ]);
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
          { id: 'json', params: [] },
          { id: 'rate', params: ['5m'] },
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
          { id: 'json', params: [] },
          { id: 'rate', params: ['5m'] },
          { id: 'sum', params: [] },
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
          { id: 'json', params: [] },
          { id: 'rate', params: ['5m'] },
          { id: '__sum_by', params: ['job', 'name'] },
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
          { id: 'json', params: [] },
          { id: 'rate', params: ['5m'] },
          { id: '__sum_without', params: ['job', 'name'] },
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
          { id: '__line_matches_regex', params: ['abc'] },
          { id: 'json', params: [] },
          { id: '__label_filter', params: ['bar', '=', 'baz'] },
          { id: 'rate', params: ['5m'] },
          { id: 'sum', params: [] },
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
          { id: 'logfmt', params: [] },
          { id: '__label_filter_no_errors', params: [] },
          { id: 'count_over_time', params: ['5m'] },
          { id: 'sum', params: [] },
          { id: 'topk', params: [10] },
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
        operations: [{ id: 'rate', params: ['$__interval'] }],
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
        operations: [{ id: 'quantile_over_time', params: ['0.99', '1m'] }],
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
        operations: [{ id: 'line_format', params: ['abc'] }],
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
        operations: [{ id: 'label_format', params: ['original', 'renameTo'] }],
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
          { id: 'label_format', params: ['original', 'renameTo'] },
          { id: 'label_format', params: ['baz', 'bar'] },
        ],
      })
    );
  });

  it('parses binary query', () => {
    expect(buildVisualQueryFromString('rate({project="bar"}[5m]) / rate({project="foo"}[5m])')).toEqual(
      noErrors({
        labels: [{ op: '=', value: 'bar', label: 'project' }],
        operations: [{ id: 'rate', params: ['5m'] }],
        binaryQueries: [
          {
            operator: '/',
            query: {
              labels: [{ op: '=', value: 'foo', label: 'project' }],
              operations: [{ id: 'rate', params: ['5m'] }],
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
          { id: 'rate', params: ['5m'] },
          { id: '__divide_by', params: [2] },
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
          { id: 'rate', params: ['5m'] },
          { id: '__multiply_by', params: [2] },
        ],
        binaryQueries: [
          {
            operator: '/',
            query: {
              labels: [{ op: '=', value: 'foo', label: 'project' }],
              operations: [{ id: 'rate', params: ['5m'] }],
              binaryQueries: [
                {
                  operator: '+',
                  query: {
                    labels: [{ op: '=', value: 'test', label: 'app' }],
                    operations: [{ id: 'rate', params: ['1m'] }],
                  },
                },
              ],
            },
          },
        ],
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
