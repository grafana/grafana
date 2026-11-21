import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { getTraceToLogsOptions, type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type LokiQuery } from 'app/features/loki-helpers/types';

import { getTraceToLogsQuery, getTraceToLogsSpanQuery, getTraceToLogsTraceQuery } from './logsLink';
import { type Trace, type TraceSpan } from './types/trace';

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
  { trace: 'trace_id', span: 'span_id' },
  { trace: 'traceID', span: 'spanID' },
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
  beforeEach(() => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('returns custom query only when configured', () => {
    const { query } = getTraceToLogsQuery(
      [{ key: 'cluster', value: 'cluster1' }],
      lokiSettings,
      { ...defaultOptions, customQuery: true, query: '{job="custom"} |= "${__trace.traceId}"' },
      '7946b05c2e2e4e5a',
      '6605c7b08e715d6c'
    );

    expect(query).toEqual([{ expr: '{job="custom"} |= "${__trace.traceId}"', refId: 't2l:custom' }]);
  });

  it('returns the legacy query when dynamicTraceToLogs is disabled', () => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: false });

    const { query } = getTraceToLogsSpanQuery(createSpan(), lokiSettings, {
      ...defaultOptions,
      filterByTraceID: true,
      filterBySpanID: true,
    });

    expect(query).toEqual({
      expr: '{${__tags}} | label_format log_line_contains_trace_id=`{{ contains "${__span.traceId}" __line__  }}` | log_line_contains_trace_id="true" or trace_id="${__span.traceId}" | label_format log_line_contains_span_id=`{{ contains "${__span.spanId}" __line__  }}` | log_line_contains_span_id="true" or span_id="${__span.spanId}"',
      refId: '',
    });
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

      expect(queries[index * 2]).toEqual({
        expr: `${tagSelector} ${pipeline}`,
        refId: `t2l:default:${trace}`,
      });
      expect(queries[index * 2 + 1]).toEqual({
        expr: `${jobSelector} ${pipeline}`,
        refId: `t2l:job:${trace}`,
      });
    }

    expect(queries[12]).toEqual({
      expr: `${tagSelector} |= "7946b05c2e2e4e5a" |= "6605c7b08e715d6c"`,
      refId: 't2l:line-contains',
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
      expr: '{cluster="cluster1", service_name="api"} | logfmt | json | drop __error__ | trace_id="7946b05c2e2e4e5a"',
      refId: 't2l:default:trace_id',
    });
    expect(queries[1].refId).toBe('t2l:job:trace_id');
    expect(queries[12]).toEqual({
      expr: '{cluster="cluster1", service_name="api"} |= "7946b05c2e2e4e5a"',
      refId: 't2l:line-contains',
    });
  });

  it('normalizes dotted trace label names to underscores for Loki', () => {
    const { query, tags } = getTraceToLogsQuery(
      [
        { key: 'service.name', value: 'api' },
        { key: 'k8s.pod.name', value: 'pod-1' },
        { key: 'http.request.method', value: 'GET' },
      ],
      lokiSettings,
      {
        ...defaultOptions,
        tags: [{ key: 'service.name', value: '' }, { key: 'k8s.pod.name' }, { key: 'http.request.method' }],
      },
      '7946b05c2e2e4e5a'
    );
    const queries = query as LokiQuery[];

    expect(tags).toBe('service_name="api", k8s_pod_name="pod-1", http_request_method="GET"');
    expect(queries[0].expr.startsWith('{service_name="api", k8s_pod_name="pod-1", http_request_method="GET"}')).toBe(
      true
    );
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
      't2l:default:trace_id',
      't2l:default:traceID',
      't2l:default:traceId',
      't2l:default:TraceID',
      't2l:default:TraceId',
      't2l:default:otel_trace_id',
      't2l:line-contains',
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

  it('builds a trace-level query without span id filters and with services from the whole trace', () => {
    const childSpan = createSpan({
      spanID: 'childspan0000001',
      process: {
        serviceName: 'payments',
        tags: [{ key: 'cluster', value: 'cluster1' }],
      },
      references: [{ refType: 'CHILD_OF', traceID: '7946b05c2e2e4e5a', spanID: '6605c7b08e715d6c' }],
    });
    const rootSpan = createSpan();
    const trace = {
      traceID: '7946b05c2e2e4e5a',
      spans: [rootSpan, childSpan],
      processes: {
        p1: rootSpan.process,
        p2: childSpan.process,
      },
    } as unknown as Trace;

    const { query } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);
    const queries = query as LokiQuery[];

    expect(queries[0].expr).toBe('{cluster="cluster1"} | logfmt | json | drop __error__ | trace_id="7946b05c2e2e4e5a"');
    expect(queries[0].refId).toBe('t2l:default:trace_id');
    expect(queries.find((q) => q.refId === 't2l:job:trace_id')?.expr).toBe(
      '{job=~"(.*/)?(checkout|payments)"} | logfmt | json | drop __error__ | trace_id="7946b05c2e2e4e5a"'
    );
    expect(queries.at(-1)).toEqual({
      expr: '{cluster="cluster1"} |= "7946b05c2e2e4e5a"',
      refId: 't2l:line-contains',
    });
  });

  it('escapes regex and string characters of service names in the job selector', () => {
    const { query } = getTraceToLogsQuery(
      [{ key: 'cluster', value: 'cluster1' }],
      lokiSettings,
      defaultOptions,
      'trace1',
      undefined,
      ['api.gateway', 'orders(v2)']
    );
    const jobQuery = (query as LokiQuery[]).find((q) => q.refId === 't2l:job:trace_id');

    expect(jobQuery?.expr).toBe(
      String.raw`{job=~"(.*/)?(api\\.gateway|orders\\(v2\\))"} | logfmt | json | drop __error__ | trace_id="trace1"`
    );
  });
});

describe('getTraceToLogsTraceQuery loki tags', () => {
  const traceID = '7946b05c2e2e4e5a';

  function createServiceSpan(spanID: string, serviceName: string, parentSpanID?: string, namespace?: string) {
    return createSpan({
      spanID,
      references: parentSpanID ? [{ refType: 'CHILD_OF', traceID, spanID: parentSpanID }] : [],
      process: {
        serviceName,
        tags: [
          { key: 'service.name', value: serviceName },
          ...(namespace ? [{ key: 'service.namespace', value: namespace }] : []),
        ],
      },
    });
  }

  function createTrace(spans: TraceSpan[]) {
    return { traceID, spans, processes: {} } as unknown as Trace;
  }

  beforeEach(() => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('matches the services of every span, not only the root span service', () => {
    const trace = createTrace([
      createServiceSpan('root', 'load-generator', undefined, 'otel-demo'),
      createServiceSpan('proxy', 'frontend-proxy', 'root', 'otel-demo'),
      createServiceSpan('order', 'checkout', 'proxy', 'otel-demo'),
      createServiceSpan('cart', 'cart', 'order', 'otel-demo'),
      createServiceSpan('order2', 'checkout', 'proxy', 'otel-demo'),
    ]);

    const { query, tags } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);
    const queries = query as LokiQuery[];
    const selector = '{service_name=~"load-generator|frontend-proxy|checkout|cart", service_namespace="otel-demo"}';

    expect(tags).toBe('service_name=~"load-generator|frontend-proxy|checkout|cart", service_namespace="otel-demo"');
    expect(queries[0]).toEqual({
      expr: `${selector} | logfmt | json | drop __error__ | trace_id="${traceID}"`,
      refId: 't2l:default:trace_id',
    });
    expect(queries.filter((q) => q.refId.startsWith('t2l:default:')).every((q) => q.expr.startsWith(selector))).toBe(
      true
    );
    expect(queries.at(-1)).toEqual({ expr: `${selector} |= "${traceID}"`, refId: 't2l:line-contains' });
    expect(queries.find((q) => q.refId === 't2l:job:trace_id')?.expr).toBe(
      `{job=~"(.*/)?(load-generator|frontend-proxy|checkout|cart)"} | logfmt | json | drop __error__ | trace_id="${traceID}"`
    );
  });

  it('starts from the root span tags when the root is not the first span', () => {
    const trace = createTrace([
      createServiceSpan('order', 'checkout', 'root', 'otel-demo'),
      createServiceSpan('root', 'load-generator', undefined, 'otel-demo'),
    ]);

    const { tags } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);

    expect(tags).toBe('service_name=~"load-generator|checkout", service_namespace="otel-demo"');
  });

  it('leaves out tags that some spans of the trace do not have', () => {
    const trace = createTrace([
      createServiceSpan('root', 'frontend-web'),
      createServiceSpan('order', 'checkout', 'root', 'otel-demo'),
    ]);

    const { tags } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);

    expect(tags).toBe('service_name=~"frontend-web|checkout"');
  });

  it('keeps exact matchers when every span has the same tag values', () => {
    const trace = createTrace([
      createServiceSpan('root', 'checkout', undefined, 'otel-demo'),
      createServiceSpan('prepare', 'checkout', 'root', 'otel-demo'),
    ]);

    const { tags } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);

    expect(tags).toBe('service_name="checkout", service_namespace="otel-demo"');
  });

  it('uses the root span tags when the spans share no tag', () => {
    const root = createSpan({
      spanID: 'root',
      process: { serviceName: 'gateway', tags: [{ key: 'hostname', value: 'host1' }] },
    });
    const trace = createTrace([root, createServiceSpan('order', 'checkout', 'root', 'otel-demo')]);

    const { tags } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);

    expect(tags).toBe('hostname="host1"');
  });

  it('follows the configured tag mapping', () => {
    const trace = createTrace([
      createServiceSpan('root', 'load-generator', undefined, 'otel-demo'),
      createServiceSpan('order', 'checkout', 'root', 'otel-demo'),
    ]);

    const { tags } = getTraceToLogsTraceQuery(trace, lokiSettings, {
      ...defaultOptions,
      tags: [{ key: 'service.name', value: 'app' }, { key: 'service.namespace' }],
    });

    expect(tags).toBe('app=~"load-generator|checkout", service_namespace="otel-demo"');
  });

  it('escapes regex and string characters in combined tag values', () => {
    const trace = createTrace([
      createServiceSpan('root', 'api.gateway'),
      createServiceSpan('order', 'orders(v2)', 'root'),
      createServiceSpan('quote', 'say "hi"', 'root'),
      createServiceSpan('legacy', String.raw`win\svc`, 'root'),
      createServiceSpan('batch', 'nightly\nbatch', 'root'),
    ]);

    const { tags } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);

    expect(tags).toBe(String.raw`service_name=~"api\\.gateway|orders\\(v2\\)|say \"hi\"|win\\\\svc|nightly\nbatch"`);
  });

  it('collects job service names from the tags and process of every span', () => {
    const unnamed = createSpan({
      spanID: 'unnamed',
      references: [{ refType: 'CHILD_OF', traceID, spanID: 'root' }],
      process: { serviceName: 'payments', tags: [{ key: 'service.name', value: '' }] },
    });
    const trace = createTrace([
      createServiceSpan('root', 'checkout'),
      unnamed,
      createServiceSpan('order', 'checkout', 'root'),
    ]);

    const { query } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);
    const jobQuery = (query as LokiQuery[]).find((q) => q.refId === 't2l:job:trace_id');

    expect(jobQuery?.expr.startsWith('{job=~"(.*/)?(checkout|payments)"}')).toBe(true);
  });

  it('combines tags for the legacy query when dynamic trace to logs is disabled', () => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: false });
    const trace = createTrace([
      createServiceSpan('root', 'load-generator', undefined, 'otel-demo'),
      createServiceSpan('order', 'checkout', 'root', 'otel-demo'),
    ]);

    const { query, tags } = getTraceToLogsTraceQuery(trace, lokiSettings, { ...defaultOptions, filterByTraceID: true });

    expect(tags).toBe('service_name=~"load-generator|checkout", service_namespace="otel-demo"');
    expect((query as LokiQuery).expr.startsWith('{${__tags}} | label_format log_line_contains_trace_id=')).toBe(true);
  });

  it('keeps the span query on the span tags', () => {
    const { tags } = getTraceToLogsSpanQuery(
      createServiceSpan('order', 'checkout', 'root', 'otel-demo'),
      lokiSettings,
      defaultOptions
    );

    expect(tags).toBe('service_name="checkout", service_namespace="otel-demo"');
  });
});

const splunkSettings = {
  uid: 'splunk1_uid',
  name: 'Splunk',
  type: 'grafana-splunk-datasource',
} as DataSourceInstanceSettings<DataSourceJsonData>;

describe('getTraceToLogsQuery Splunk custom query', () => {
  const tags = [{ key: 'cluster', value: 'cluster1' }];
  const customQueryText = 'index=app $__span.traceId';

  it('Case A: uses custom query when customQuery is true', () => {
    const { query } = getTraceToLogsQuery(
      tags,
      splunkSettings,
      { customQuery: true, query: customQueryText, filterByTraceID: true },
      '7946b05c2e2e4e5a'
    );

    expect(query).toEqual({ query: customQueryText, refId: '' });
  });

  it('Case B: ignores leftover query text when customQuery is explicitly false', () => {
    const { query } = getTraceToLogsQuery(
      tags,
      splunkSettings,
      { customQuery: false, query: customQueryText, filterByTraceID: true },
      '7946b05c2e2e4e5a'
    );

    expect(query).toEqual({ query: '${__tags} "7946b05c2e2e4e5a"', refId: '' });
  });

  it('Case C: uses configured query when customQuery is omitted and query is set', () => {
    const { query } = getTraceToLogsQuery(
      tags,
      splunkSettings,
      // Provisioned / hand-edited V2 may omit the boolean while still setting query.
      { query: customQueryText, filterByTraceID: true } as TraceToLogsOptionsV2,
      '7946b05c2e2e4e5a'
    );

    expect(query).toEqual({ query: customQueryText, refId: '' });
  });

  it('uses custom query when customQuery is a truthy non-boolean value', () => {
    const { query } = getTraceToLogsQuery(
      tags,
      splunkSettings,
      // JSON written by API clients can carry the flag as a string.
      { customQuery: 'true', query: customQueryText, filterByTraceID: true } as unknown as TraceToLogsOptionsV2,
      '7946b05c2e2e4e5a'
    );

    expect(query).toEqual({ query: customQueryText, refId: '' });
  });

  it('uses the V2 custom query when jsonData also has a legacy tracesToLogs key', () => {
    const options = getTraceToLogsOptions({
      tracesToLogsV2: {
        datasourceUid: 'splunk1_uid',
        customQuery: true,
        query: customQueryText,
        filterByTraceID: true,
      },
      tracesToLogs: {
        datasourceUid: 'splunk1_uid',
        tags: ['cluster'],
        filterByTraceID: true,
        filterBySpanID: true,
      },
    });

    const { query } = getTraceToLogsSpanQuery(createSpan(), splunkSettings, options!);

    expect(query).toEqual({ query: customQueryText, refId: '' });
  });
});
