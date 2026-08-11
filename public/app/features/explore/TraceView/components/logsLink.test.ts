import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';
import { type LokiQuery } from 'app/features/loki-helpers/types';

import { getTraceToLogsQuery, getTraceToLogsSpanQuery } from './logsLink';
import { type TraceSpan } from './types/trace';

const lokiSettings = {
  uid: 'loki1_uid',
  name: 'Loki',
  type: 'loki',
} as DataSourceInstanceSettings<DataSourceJsonData>;

const defaultOptions: TraceToLogsOptionsV2 = {
  customQuery: false,
  datasourceUid: 'loki1_uid',
};

const TRACE_SPAN_FIELD_VARIANTS = [
  { trace: 'traceID', span: 'spanID' },
  { trace: 'trace_id', span: 'span_id' },
  { trace: 'traceId', span: 'spanId' },
  { trace: 'TraceID', span: 'SpanID' },
  { trace: 'TraceId', span: 'SpanId' },
  { trace: 'otel_trace_id', span: 'otel_span_id' },
] as const;

function createSpan(overrides: Partial<TraceSpan> = {}): TraceSpan {
  return {
    spanID: '6605c7b08e715d6c',
    traceID: '7946b05c2e2e4e5a',
    processID: 'processId',
    operationName: 'operation',
    logs: [],
    startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
    duration: 1000 * 1000,
    flags: 0,
    hasChildren: false,
    dataFrameRowIndex: 0,
    tags: [],
    process: {
      serviceName: 'checkout',
      tags: [
        { key: 'cluster', value: 'cluster1' },
        { key: 'hostname', value: 'hostname1' },
        { key: 'service.namespace', value: 'namespace1' },
      ],
    },
    ...overrides,
  } as TraceSpan;
}

describe('getTraceToLogsQuery loki alternatives', () => {
  it('returns custom query only when configured', () => {
    const { query } = getTraceToLogsQuery(
      [{ key: 'cluster', value: 'cluster1' }],
      lokiSettings,
      { ...defaultOptions, customQuery: true, query: '{job="custom"} |= "${__trace.traceId}"' },
      '7946b05c2e2e4e5a',
      '6605c7b08e715d6c'
    );

    expect(query).toEqual([{ expr: '{job="custom"} |= "${__trace.traceId}"', refId: 'custom' }]);
  });

  it('creates default and job variants for each id field name, plus line-contains', () => {
    const { query } = getTraceToLogsSpanQuery(createSpan(), lokiSettings, defaultOptions);
    const queries = query as LokiQuery[];
    const tagSelector = '{cluster="cluster1", hostname="hostname1", service_namespace="namespace1"}';
    const jobSelector = '{job=~"(.*/)?(checkout)"}';

    // 6 field variants × (default + job) + line-contains
    expect(queries).toHaveLength(13);

    for (const [index, { trace, span }] of TRACE_SPAN_FIELD_VARIANTS.entries()) {
      const pipeline = `| logfmt | json | drop __error__ | ${trace}="7946b05c2e2e4e5a" | ${span}="6605c7b08e715d6c"`;
      const fieldRef = `${trace}:${span}`;

      expect(queries[index * 2]).toEqual({
        expr: `${tagSelector} ${pipeline}`,
        refId: `t2l:default:${fieldRef}`,
      });
      expect(queries[index * 2 + 1]).toEqual({
        expr: `${jobSelector} ${pipeline}`,
        refId: `t2l:job:${fieldRef}`,
      });
    }

    expect(queries[12]).toEqual({
      expr: `${tagSelector} |= "7946b05c2e2e4e5a" |= "6605c7b08e715d6c"`,
      refId: 'line-contains',
    });
  });

  it('omits span id filters and span field from refId when spanID is not passed', () => {
    const { query } = getTraceToLogsQuery(
      [
        { key: 'cluster', value: 'cluster1' },
        { key: 'service.name', value: 'api' },
      ],
      lokiSettings,
      defaultOptions,
      '7946b05c2e2e4e5a'
    );
    const queries = query as LokiQuery[];

    expect(queries).toHaveLength(13);
    expect(queries[0]).toEqual({
      expr: '{cluster="cluster1", service_name="api"} | logfmt | json | drop __error__ | traceID="7946b05c2e2e4e5a"',
      refId: 't2l:default:traceID',
    });
    expect(queries[1].refId).toBe('t2l:job:traceID');
    expect(queries[12]).toEqual({
      expr: '{cluster="cluster1", service_name="api"} |= "7946b05c2e2e4e5a"',
      refId: 'line-contains',
    });
  });

  it('skips job variants when there are no service names', () => {
    const { query } = getTraceToLogsQuery(
      [{ key: 'cluster', value: 'cluster1' }],
      lokiSettings,
      defaultOptions,
      '7946b05c2e2e4e5a',
      '6605c7b08e715d6c'
    );
    const queries = query as LokiQuery[];

    // 6 default variants + line-contains
    expect(queries).toHaveLength(7);
    expect(queries.map((q) => q.refId)).toEqual([
      't2l:default:traceID:spanID',
      't2l:default:trace_id:span_id',
      't2l:default:traceId:spanId',
      't2l:default:TraceID:SpanID',
      't2l:default:TraceId:SpanId',
      't2l:default:otel_trace_id:otel_span_id',
      'line-contains',
    ]);
  });

  it('joins multiple service names in the job selector', () => {
    const { query } = getTraceToLogsQuery(
      [
        { key: 'cluster', value: 'cluster1' },
        { key: 'service.name', value: 'service1' },
        { key: 'service.name', value: 'service2' },
      ],
      lokiSettings,
      defaultOptions,
      'trace1',
      undefined,
      ['service1', 'service2']
    );
    const queries = query as LokiQuery[];
    const jobQuery = queries.find((q) => q.refId === 't2l:job:trace_id');

    expect(jobQuery?.expr).toBe(
      '{job=~"(.*/)?(service1|service2)"} | logfmt | json | drop __error__ | trace_id="trace1"'
    );
  });

  it('returns undefined when no mapped tags are present', () => {
    const { query } = getTraceToLogsQuery(
      [{ key: 'unrelated', value: 'x' }],
      lokiSettings,
      { ...defaultOptions, tags: [{ key: 'cluster' }] },
      '7946b05c2e2e4e5a'
    );

    expect(query).toBeUndefined();
  });
});
