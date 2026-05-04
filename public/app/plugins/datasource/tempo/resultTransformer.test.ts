import { type collectorTypes } from '@opentelemetry/exporter-collector';

import {
  FieldType,
  MutableDataFrame,
  type Field,
  PluginType,
  type DataSourceInstanceSettings,
  type PluginMetaInfo,
} from '@grafana/data';

import {
  transformToOTLP,
  transformFromOTLP,
  createTableFrameFromTraceQlQuery,
  createTableFrameFromTraceQlQueryAsSpans,
} from './resultTransformer';
import {
  badOTLPResponse,
  otlpDataFrameToResponse,
  otlpDataFrameFromResponse,
  otlpResponse,
  traceQlResponse,
} from './test/testResponse';
import { type TraceSearchMetadata } from './types';

const defaultSettings: DataSourceInstanceSettings = {
  uid: '0',
  type: 'tracing',
  name: 'tempo',
  access: 'proxy',
  meta: {
    id: 'tempo',
    name: 'tempo',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  readOnly: false,
  jsonData: {},
};

describe('transformToOTLP()', () => {
  test('transforms dataframe to OTLP format', () => {
    const otlp = transformToOTLP(otlpDataFrameToResponse);
    expect(otlp).toMatchObject(otlpResponse);
  });

  test('groups multiple spans with the same service name into a single batch', () => {
    const frame = new MutableDataFrame({
      fields: [
        {
          name: 'traceID',
          type: FieldType.string,
          values: ['aabbccdd00000000aabbccdd00000000', 'aabbccdd00000000aabbccdd00000000'],
        },
        { name: 'spanID', type: FieldType.string, values: ['span000000000001', 'span000000000002'] },
        { name: 'parentSpanID', type: FieldType.string, values: ['', 'span000000000001'] },
        { name: 'operationName', type: FieldType.string, values: ['op1', 'op2'] },
        { name: 'serviceName', type: FieldType.string, values: ['my-service', 'my-service'] },
        { name: 'kind', type: FieldType.string, values: ['server', 'client'] },
        { name: 'statusCode', type: FieldType.number, values: [0, 0] },
        { name: 'statusMessage', type: FieldType.string, values: ['', ''] },
        { name: 'instrumentationLibraryName', type: FieldType.string, values: ['', ''] },
        { name: 'instrumentationLibraryVersion', type: FieldType.string, values: ['', ''] },
        { name: 'traceState', type: FieldType.string, values: ['', ''] },
        {
          name: 'serviceTags',
          type: FieldType.other,
          values: [
            [
              { key: 'service.name', value: 'my-service' },
              { key: 'host.name', value: 'host-1' },
            ],
            [
              { key: 'service.name', value: 'my-service' },
              { key: 'host.name', value: 'host-2' },
            ],
          ],
        },
        { name: 'startTime', type: FieldType.number, values: [1000, 2000] },
        { name: 'duration', type: FieldType.number, values: [10, 20] },
        { name: 'logs', type: FieldType.other, values: [[], []] },
        { name: 'tags', type: FieldType.other, values: [[], []] },
        { name: 'references', type: FieldType.other, values: [[], []] },
      ],
    });

    const result = transformToOTLP(frame);

    // Both spans share the same service and must land in exactly one batch
    expect(result.batches).toHaveLength(1);
    // That one batch must contain both spans
    expect(result.batches[0].instrumentationLibrarySpans[0].spans).toHaveLength(2);
  });
});

describe('transformFromOTLP()', () => {
  test('transforms OTLP format to dataFrame', () => {
    const res = transformFromOTLP(
      otlpResponse.batches as unknown as collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
      false
    );
    expect(res.data[0]).toMatchObject({
      ...otlpDataFrameFromResponse,
      creator: expect.any(Function),
    });
  });

  test('extracts service.namespace from resource attributes into serviceNamespace column', () => {
    const batchesWithNamespace = [
      {
        ...otlpResponse.batches[0],
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'cart-service' } },
            { key: 'service.namespace', value: { stringValue: 'production' } },
            { key: 'host.name', value: { stringValue: 'host1' } },
          ],
        },
      },
    ];
    const res = transformFromOTLP(
      batchesWithNamespace as unknown as collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
      false
    );
    expect(res.data).toHaveLength(1);
    const frame = res.data[0];
    const serviceNamespaceField = frame.fields.find((f: Field) => f.name === 'serviceNamespace');
    expect(serviceNamespaceField).toBeDefined();
    expect(serviceNamespaceField!.values[0]).toBe('production');
    const serviceNameField = frame.fields.find((f: Field) => f.name === 'serviceName');
    expect(serviceNameField!.values[0]).toBe('cart-service');
  });

  test('coalesces service.namespace.name when service.namespace is not present', () => {
    const batchesWithAltNamespace = [
      {
        ...otlpResponse.batches[0],
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'api' } },
            { key: 'service.namespace.name', value: { stringValue: 'staging' } },
          ],
        },
      },
    ];
    const res = transformFromOTLP(
      batchesWithAltNamespace as unknown as collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
      false
    );
    expect(res.data).toHaveLength(1);
    const serviceNamespaceField = res.data[0].fields.find((f: Field) => f.name === 'serviceNamespace');
    expect(serviceNamespaceField).toBeDefined();
    expect(serviceNamespaceField!.values[0]).toBe('staging');
  });

  test('leaves serviceNamespace undefined when no namespace attribute is present', () => {
    const res = transformFromOTLP(
      otlpResponse.batches as unknown as collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
      false
    );
    const serviceNamespaceField = res.data[0].fields.find((f: Field) => f.name === 'serviceNamespace');
    expect(serviceNamespaceField).toBeDefined();
    expect(serviceNamespaceField!.values[0]).toBeUndefined();
  });
});

describe('createTableFrameFromTraceQlQuery()', () => {
  test('transforms TraceQL response to DataFrame', () => {
    const frameList = createTableFrameFromTraceQlQuery(traceQlResponse.traces, defaultSettings);
    const frame = frameList[0];
    // Trace ID field
    expect(frame.fields[0].name).toBe('traceID');
    expect(frame.fields[0].values[0]).toBe('b1586c3c8c34d');
    expect(frame.fields[0].config.unit).toBe('string');
    // Start time field
    expect(frame.fields[1].name).toBe('startTime');
    expect(frame.fields[1].type).toBe('time');
    expect(frame.fields[1].values[1]).toBe(1643342166678.0002);
    // Trace service field
    expect(frame.fields[2].name).toBe('traceService');
    expect(frame.fields[2].type).toBe('string');
    expect(frame.fields[2].values[0]).toBe('lb');
    // Trace name field
    expect(frame.fields[3].name).toBe('traceName');
    expect(frame.fields[3].type).toBe('string');
    expect(frame.fields[3].values[0]).toBe('HTTP Client');
    // Duration field
    expect(frame.fields[4].name).toBe('traceDuration');
    expect(frame.fields[4].type).toBe('number');
    expect(frame.fields[4].values[2]).toBe(44);
    expect(frame.fields[4].values[1]).toBe('<1ms');
    // Subframes field
    expect(frame.fields[5].name).toBe('nested');
    expect(frame.fields[5].type).toBe('nestedFrames');
    // Single spanset
    expect(frame.fields[5].values[0][0].fields[0].name).toBe('traceIdHidden');
    expect(frame.fields[5].values[0][0].fields[0].values[0]).toBe('b1586c3c8c34d');
    expect(frame.fields[5].values[0][0].fields[1].name).toBe('spanID');
    expect(frame.fields[5].values[0][0].fields[1].values[0]).toBe('162a4adae63b61f1');
    expect(frame.fields[5].values[0][0].fields[2].name).toBe('time');
    expect(frame.fields[5].values[0][0].fields[2].values[0]).toBe(1666188214303.201);
    expect(frame.fields[5].values[0][0].fields[4].name).toBe('http.method');
    expect(frame.fields[5].values[0][0].fields[4].values[0]).toBe('GET');
    expect(frame.fields[5].values[0][0].fields[5].name).toBe('service.name');
    expect(frame.fields[5].values[0][0].fields[5].values[0]).toBe('db');
    expect(frame.fields[5].values[0][0].fields[6].name).toBe('duration');
    expect(frame.fields[5].values[0][0].fields[6].values[0]).toBe(545000);
    // Multiple spansets - set 0
    expect(frame.fields[5].values[1][0].fields[0].name).toBe('traceIdHidden');
    expect(frame.fields[5].values[1][0].fields[0].values[0]).toBe('9161e77388f3e');
    expect(frame.fields[5].values[1][0].fields[1].name).toBe('spanID');
    expect(frame.fields[5].values[1][0].fields[1].values[0]).toBe('3b9a5c222d3ddd8f');
    expect(frame.fields[5].values[1][0].fields[2].name).toBe('time');
    expect(frame.fields[5].values[1][0].fields[2].values[0]).toBe(1666187875397.7212);
    expect(frame.fields[5].values[1][0].fields[4].name).toBe('by(resource.service.name)');
    expect(frame.fields[5].values[1][0].fields[4].values[0]).toBe('db');
    expect(frame.fields[5].values[1][0].fields[5].name).toBe('http.method');
    expect(frame.fields[5].values[1][0].fields[5].values[0]).toBe('GET');
    expect(frame.fields[5].values[1][0].fields[6].name).toBe('service.name');
    expect(frame.fields[5].values[1][0].fields[6].values[0]).toBe('db');
    expect(frame.fields[5].values[1][0].fields[7].name).toBe('duration');
    expect(frame.fields[5].values[1][0].fields[7].values[0]).toBe(877000);
    // Multiple spansets - set 1
    expect(frame.fields[5].values[1][1].fields[0].name).toBe('traceIdHidden');
    expect(frame.fields[5].values[1][1].fields[0].values[0]).toBe('9161e77388f3e');
    expect(frame.fields[5].values[1][1].fields[1].name).toBe('spanID');
    expect(frame.fields[5].values[1][1].fields[1].values[0]).toBe('894d90db6b5807f');
    expect(frame.fields[5].values[1][1].fields[2].name).toBe('time');
    expect(frame.fields[5].values[1][1].fields[2].values[0]).toBe(1666187875393.293);
    expect(frame.fields[5].values[1][1].fields[4].name).toBe('by(resource.service.name)');
    expect(frame.fields[5].values[1][1].fields[4].values[0]).toBe('app');
    expect(frame.fields[5].values[1][1].fields[5].name).toBe('http.method');
    expect(frame.fields[5].values[1][1].fields[5].values[0]).toBe('GET');
    expect(frame.fields[5].values[1][1].fields[6].name).toBe('service.name');
    expect(frame.fields[5].values[1][1].fields[6].values[0]).toBe('app');
    expect(frame.fields[5].values[1][1].fields[7].name).toBe('duration');
    expect(frame.fields[5].values[1][1].fields[7].values[0]).toBe(11073000);
  });
});

describe('createTableFrameFromTraceQlQueryAsSpans()', () => {
  test('transforms TraceQL legacy response to DataFrame for Spans table type', () => {
    const traces = [
      {
        traceID: '1',
        rootServiceName: 'prometheus',
        rootTraceName: 'POST /api/v1/write',
        startTimeUnixNano: '1702984850354934104',
        durationMs: 1,
        spanSet: {
          spans: [
            {
              spanID: '11',
              startTimeUnixNano: '1702984850354934104',
              durationNanos: '1377608',
            },
          ],
          matched: 1,
          attributes: [{ key: 'attr-key-1', value: { intValue: '123' } }],
        },
      },
      {
        traceID: '2',
        rootServiceName: 'prometheus',
        rootTraceName: 'GET /api/v1/status/config',
        startTimeUnixNano: '1702984840786143459',
        spanSet: {
          spans: [
            {
              spanID: '21',
              startTimeUnixNano: '1702984840786143459',
              durationNanos: '542316',
            },
          ],
          matched: 1,
          attributes: [{ key: 'attr-key-2', value: { stringValue: '456' } }],
        },
      },
    ];
    const frameList = createTableFrameFromTraceQlQueryAsSpans(traces, defaultSettings);
    const frame = frameList[0];

    // Trace ID field
    expect(frame.fields[0].name).toBe('traceIdHidden');
    expect(frame.fields[0].type).toBe('string');
    expect(frame.fields[0].values[0]).toBe('1');
    // Trace service field
    expect(frame.fields[1].name).toBe('traceService');
    expect(frame.fields[1].type).toBe('string');
    expect(frame.fields[1].values[0]).toBe('prometheus');
    // Trace name field
    expect(frame.fields[2].name).toBe('traceName');
    expect(frame.fields[2].type).toBe('string');
    expect(frame.fields[2].values[0]).toBe('POST /api/v1/write');
    // Span ID field
    expect(frame.fields[3].name).toBe('spanID');
    expect(frame.fields[3].type).toBe('string');
    expect(frame.fields[3].values[0]).toBe('11');
    // Time field
    expect(frame.fields[4].name).toBe('time');
    expect(frame.fields[4].type).toBe('time');
    expect(frame.fields[4].values[0]).toBe(1702984850354.934);
    // Name field
    expect(frame.fields[5].name).toBe('name');
    expect(frame.fields[5].type).toBe('string');
    expect(frame.fields[5].values[0]).toBe(undefined);
    // Dynamic fields
    expect(frame.fields[6].name).toBe('attr-key-1');
    expect(frame.fields[6].type).toBe('string');
    expect(frame.fields[6].values[0]).toBe('123');
    expect(frame.fields[6].values[1]).toBe(undefined);
    expect(frame.fields[6].values.length).toBe(2);
    expect(frame.fields[7].name).toBe('attr-key-2');
    expect(frame.fields[7].type).toBe('string');
    expect(frame.fields[7].values[0]).toBe(undefined);
    expect(frame.fields[7].values[1]).toBe('456');
    expect(frame.fields[7].values.length).toBe(2);
    // Duration field
    expect(frame.fields[8].name).toBe('duration');
    expect(frame.fields[8].type).toBe('number');
    expect(frame.fields[8].values[0]).toBe(1377608);
    // No more fields
    expect(frame.fields.length).toBe(9);
  });

  test('transforms TraceQL response to DataFrame for Spans table type', () => {
    const traces = [
      {
        traceID: '1',
        rootServiceName: 'prometheus',
        rootTraceName: 'POST /api/v1/write',
        startTimeUnixNano: '1702984850354934104',
        durationMs: 1,
        spanSets: [
          {
            spans: [
              {
                spanID: '11',
                startTimeUnixNano: '1702984850354934104',
                durationNanos: '1377608',
              },
            ],

            matched: 1,
            attributes: [{ key: 'attr-key-1', value: { intValue: '123' } }],
          },
        ],
      },
      {
        traceID: '2',
        rootServiceName: 'prometheus',
        rootTraceName: 'GET /api/v1/status/config',
        startTimeUnixNano: '1702984840786143459',
        spanSets: [
          {
            spans: [
              {
                spanID: '21',
                startTimeUnixNano: '1702984840786143459',
                durationNanos: '542316',
              },
            ],
            matched: 1,
            attributes: [{ key: 'attr-key-2', value: { stringValue: '456' } }],
          },
        ],
      },
    ];
    const frameList = createTableFrameFromTraceQlQueryAsSpans(traces, defaultSettings);
    const frame = frameList[0];

    // Trace ID field
    expect(frame.fields[0].name).toBe('traceIdHidden');
    expect(frame.fields[0].type).toBe('string');
    expect(frame.fields[0].values[0]).toBe('1');
    // Trace service field
    expect(frame.fields[1].name).toBe('traceService');
    expect(frame.fields[1].type).toBe('string');
    expect(frame.fields[1].values[0]).toBe('prometheus');
    // Trace name field
    expect(frame.fields[2].name).toBe('traceName');
    expect(frame.fields[2].type).toBe('string');
    expect(frame.fields[2].values[0]).toBe('POST /api/v1/write');
    // Span ID field
    expect(frame.fields[3].name).toBe('spanID');
    expect(frame.fields[3].type).toBe('string');
    expect(frame.fields[3].values[0]).toBe('11');
    // Time field
    expect(frame.fields[4].name).toBe('time');
    expect(frame.fields[4].type).toBe('time');
    expect(frame.fields[4].values[0]).toBe(1702984850354.934);
    // Name field
    expect(frame.fields[5].name).toBe('name');
    expect(frame.fields[5].type).toBe('string');
    expect(frame.fields[5].values[0]).toBe(undefined);
    // Dynamic fields
    expect(frame.fields[6].name).toBe('attr-key-1');
    expect(frame.fields[6].type).toBe('string');
    expect(frame.fields[6].values[0]).toBe('123');
    expect(frame.fields[6].values[1]).toBe(undefined);
    expect(frame.fields[6].values.length).toBe(2);
    expect(frame.fields[7].name).toBe('attr-key-2');
    expect(frame.fields[7].type).toBe('string');
    expect(frame.fields[7].values[0]).toBe(undefined);
    expect(frame.fields[7].values[1]).toBe('456');
    expect(frame.fields[7].values.length).toBe(2);
    // Duration field
    expect(frame.fields[8].name).toBe('duration');
    expect(frame.fields[8].type).toBe('number');
    expect(frame.fields[8].values[0]).toBe(1377608);
    // No more fields
    expect(frame.fields.length).toBe(9);
  });

  it.each([[undefined], [[]]])('TraceQL response with no data', (traces: TraceSearchMetadata[] | undefined) => {
    const frameList = createTableFrameFromTraceQlQueryAsSpans(traces, defaultSettings);
    const frame = frameList[0];

    // Trace ID field
    expect(frame.fields[0].name).toBe('traceIdHidden');
    expect(frame.fields[0].type).toBe('string');
    expect(frame.fields[0].values).toMatchObject([]);
    // Trace service field
    expect(frame.fields[1].name).toBe('traceService');
    expect(frame.fields[1].type).toBe('string');
    expect(frame.fields[1].values).toMatchObject([]);
    // Trace name field
    expect(frame.fields[2].name).toBe('traceName');
    expect(frame.fields[2].type).toBe('string');
    expect(frame.fields[2].values).toMatchObject([]);
    // Span ID field
    expect(frame.fields[3].name).toBe('spanID');
    expect(frame.fields[3].type).toBe('string');
    expect(frame.fields[3].values).toMatchObject([]);
    // Time field
    expect(frame.fields[4].name).toBe('time');
    expect(frame.fields[4].type).toBe('time');
    expect(frame.fields[4].values).toMatchObject([]);
    // Name field
    expect(frame.fields[5].name).toBe('name');
    expect(frame.fields[5].type).toBe('string');
    expect(frame.fields[5].values).toMatchObject([]);
    // Duration field
    expect(frame.fields[6].name).toBe('duration');
    expect(frame.fields[6].type).toBe('number');
    expect(frame.fields[6].values).toMatchObject([]);
    // No more fields
    expect(frame.fields.length).toBe(7);
  });

  test('handles spans with missing durationNanos gracefully (no NaN)', () => {
    const traces: TraceSearchMetadata[] = [
      {
        traceID: '1',
        rootServiceName: 'test-service',
        rootTraceName: 'test-operation',
        startTimeUnixNano: '1702984850354934104',
        durationMs: 1,
        spanSet: {
          spans: [
            {
              spanID: '11',
              startTimeUnixNano: '1702984850354934104',
              // durationNanos intentionally omitted to simulate incomplete span
            },
          ],
          matched: 1,
        },
      },
    ];
    const frameList = createTableFrameFromTraceQlQueryAsSpans(traces as TraceSearchMetadata[], defaultSettings);
    const frame = frameList[0];
    const durationField = frame.fields.find((f) => f.name === 'duration');
    expect(durationField).toBeDefined();
    expect(durationField!.values[0]).toBe(0);
    expect(Number.isNaN(durationField!.values[0])).toBe(false);
  });
});

describe('transformFromOTLP()', () => {
  // Mock the console error so that running the test suite doesnt throw the error
  const origError = console.error;
  const consoleErrorMock = jest.fn();
  afterEach(() => (console.error = origError));
  beforeEach(() => (console.error = consoleErrorMock));

  test('if passed bad data, will surface an error', () => {
    const res = transformFromOTLP(
      badOTLPResponse.batches as unknown as collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
      false
    );

    expect(res.data[0]).toBeFalsy();
    expect(res.error?.message).toBeTruthy();
    // if it does have resources, no error will be thrown
    expect({
      ...res.data[0],
      resources: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'db' } },
          { key: 'job', value: { stringValue: 'tns/db' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.name', value: { stringValue: '63d16772b4a2' } },
          { key: 'ip', value: { stringValue: '0.0.0.0' } },
          { key: 'client-uuid', value: { stringValue: '39fb01637a579639' } },
        ],
      },
    }).not.toBeFalsy();
  });

  test('handles spans with missing endTimeUnixNano gracefully (no NaN)', () => {
    const otlpWithMissingEnd: collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[] = [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'test-service' } }],
          droppedAttributesCount: 0,
        },
        instrumentationLibrarySpans: [
          {
            spans: [
              {
                traceId: 'AAAAAAAAAABguiq7RPE+rg==',
                spanId: 'cmteMBAvwNA=',
                parentSpanId: '',
                name: 'incomplete-span',
                kind: 'SPAN_KIND_SERVER' as any,
                startTimeUnixNano: 1627471657255809000,
                endTimeUnixNano: undefined as unknown as number,
                attributes: [],
                droppedAttributesCount: 0,
                droppedEventsCount: 0,
                droppedLinksCount: 0,
                status: { code: 0 },
                events: [],
                links: [],
              },
            ],
          },
        ],
      },
    ];
    const res = transformFromOTLP(otlpWithMissingEnd, false);
    const durationField = res.data[0].fields.find((f: { name: string }) => f.name === 'duration');
    expect(durationField).toBeDefined();
    expect(durationField!.values[0]).toBe(0);
    expect(Number.isNaN(durationField!.values[0])).toBe(false);
  });
});
