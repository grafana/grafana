import {
  DataSourceInstanceSettings,
  LinkModel,
  createDataFrame,
  SupportedTransformationType,
  DataLinkConfigOrigin,
  FieldType,
  DataFrame,
} from '@grafana/data';
import { TraceToLogsOptionsV2, TraceToMetricsOptions } from '@grafana/o11y-ds-frontend';
import { DataSourceSrv, setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

import { LinkSrv, setLinkSrv } from '../../panel/panellinks/link_srv';
import { TemplateSrv } from '../../templating/template_srv';

import { Trace, TraceSpan } from './components';
import { SpanLinkType } from './components/types/links';
import { createSpanLinkFactory, pyroscopeProfileIdTagKey } from './createSpanLink';

const dummyTraceData = { duration: 10, traceID: 'trace1', traceName: 'test trace' } as unknown as Trace;
const dummyDataFrame = createDataFrame({
  fields: [
    { name: 'traceId', values: ['trace1'] },
    { name: 'spanID', values: ['testSpanId'] },
  ],
});
const dummyDataFrameForProfiles = createDataFrame({
  fields: [
    { name: 'traceId', values: ['trace1'] },
    { name: 'spanID', values: ['testSpanId'] },
    {
      name: 'tags',
      config: {
        links: [
          {
            internal: {
              query: {
                labelSelector: '{${__tags}}',
                groupBy: [],
                profileTypeId: '',
                queryType: 'profile',
                spanSelector: ['${__span.spanId}'],
                refId: '',
              },
              datasourceUid: 'pyroscopeUid',
              datasourceName: 'pyroscope',
            },
            url: '',
            title: 'Test',
            origin: DataLinkConfigOrigin.Datasource,
          },
        ],
      },
      values: [{ key: 'test', value: 'test' }],
    },
  ],
});

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasAccessToExplore: () => true,
  },
}));

describe('createSpanLinkFactory', () => {
  it('returns no links if there is no data source uid', () => {
    const splitOpenFn = jest.fn();
    const createLink = createSpanLinkFactory({
      splitOpenFn: splitOpenFn,
      trace: dummyTraceData,
      dataFrame: dummyDataFrame,
    });
    const links = createLink!(createTraceSpan());
    expect(links).toBeDefined();
    expect(links).toHaveLength(0);
  });

  describe('should return loki link', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return { uid: 'loki1_uid', name: 'loki1', type: 'loki' } as unknown as DataSourceInstanceSettings;
        },
      } as unknown as DataSourceSrv);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('with default keys when tags not configured', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"loki1_uid","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\", service_namespace=\\"namespace1\\"}","refId":""}]}'
        )}`
      );
    });

    it('with tags that passed in and without tags that are not in the span', () => {
      const createLink = setupSpanLinkFactory({
        tags: [{ key: 'ip' }, { key: 'newTag' }],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"loki1_uid","queries":[{"expr":"{ip=\\"192.168.0.1\\"}","refId":""}]}'
        )}`
      );
    });

    it('from tags and process tags as well', () => {
      const createLink = setupSpanLinkFactory({
        tags: [{ key: 'ip' }, { key: 'host' }],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"loki1_uid","queries":[{"expr":"{ip=\\"192.168.0.1\\", host=\\"host\\"}","refId":""}]}'
        )}`
      );
    });

    it('with adjusted start and end time', () => {
      const createLink = setupSpanLinkFactory({
        spanStartTimeShift: '-1m',
        spanEndTimeShift: '1m',
      });
      expect(createLink).toBeDefined();
      const span = createTraceSpan({
        process: {
          serviceName: 'service',
          tags: [
            { key: 'hostname', value: 'hostname1' },
            { key: 'ip', value: '192.168.0.1' },
          ],
        },
      });
      const links = createLink!(span);
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"${span.startTime / 1000 - 60000}","to":"${
            span.startTime / 1000 + span.duration / 1000 + 60000
          }"},"datasource":"loki1_uid","queries":[{"expr":"{hostname=\\"hostname1\\"}","refId":""}]}`
        )}`
      );
    });

    it('filters by trace and span ID', () => {
      const createLink = setupSpanLinkFactory({
        filterBySpanID: true,
        filterByTraceID: true,
      });
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(decodeURIComponent(linkDef!.href)).toBe(
        '/explore?left=' +
          JSON.stringify({
            range: { from: '1602637200000', to: '1602637201000' },
            datasource: 'loki1_uid',
            queries: [
              {
                expr: '{cluster="cluster1", hostname="hostname1", service_namespace="namespace1"} |="7946b05c2e2e4e5a" |="6605c7b08e715d6c"',
                refId: '',
              },
            ],
          })
      );
    });

    it('creates link from dataFrame', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        dataFrame: createDataFrame({
          fields: [
            { name: 'traceID', values: ['testTraceId'] },
            {
              name: 'spanID',
              config: { links: [{ title: 'link', url: '${__data.fields.spanID}' }] },
              values: ['testSpanId'],
            },
          ],
        }),
        trace: dummyTraceData,
      });
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Unknown);
      expect(linkDef!.href).toBe('testSpanId');
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        tags: [
          { key: 'service.name', value: 'service' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"loki1_uid","queries":[{"expr":"{service=\\"serviceName\\", pod=\\"podName\\"}","refId":""}]}'
        )}`
      );
    });

    it('handles incomplete renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        tags: [
          { key: 'service.name', value: '' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"loki1_uid","queries":[{"expr":"{service.name=\\"serviceName\\", pod=\\"podName\\"}","refId":""}]}'
        )}`
      );
    });

    it('handles empty queries', () => {
      const createLink = setupSpanLinkFactory({
        tags: [],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [{ key: 'k8s.pod.name', value: 'podName' }],
          },
        })
      );
      expect(links).toBeDefined();
      expect(links?.length).toEqual(0);
    });

    it('interpolates span intrinsics', () => {
      const createLink = setupSpanLinkFactory({
        tags: [{ key: 'name', value: 'spanName' }],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());
      expect(links).toBeDefined();
      expect(links![0].type).toBe(SpanLinkType.Logs);
      expect(decodeURIComponent(links![0].href)).toContain('spanName=\\"operation\\"');
    });
  });

  describe('should return splunk link', () => {
    const splunkUID = 'splunkUID';

    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return {
            uid: splunkUID,
            name: 'Splunk 8',
            type: 'grafana-splunk-datasource',
          } as unknown as DataSourceInstanceSettings;
        },
      } as unknown as DataSourceSrv);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('the `query` keyword is used in the link rather than `expr` that loki uses', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toContain(`${encodeURIComponent('datasource":"splunkUID","queries":[{"query"')}`);
      expect(linkDef!.href).not.toContain(`${encodeURIComponent('datasource":"splunkUID","queries":[{"expr"')}`);
    });

    it('automatically timeshifts the timerange by one second in a splunk query', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toContain(
        `${encodeURIComponent('{"range":{"from":"1602637200000","to":"1602637201000"}')}`
      );
      expect(linkDef!.href).not.toContain(
        `${encodeURIComponent('{"range":{"from":"1602637200000","to":"1602637200000"}')}`
      );
    });

    it('formats query correctly if filterByTraceID and or filterBySpanID is true', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
        filterByTraceID: true,
        filterBySpanID: true,
      });

      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"splunkUID","queries":[{"query":"cluster=\\"cluster1\\" hostname=\\"hostname1\\" service_namespace=\\"namespace1\\" \\"7946b05c2e2e4e5a\\" \\"6605c7b08e715d6c\\"","refId":""}]}'
        )}`
      );
    });

    it('should format one tag correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: [{ key: 'ip' }],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [{ key: 'ip', value: '192.168.0.1' }],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"splunkUID","queries":[{"query":"ip=\\"192.168.0.1\\"","refId":""}]}'
        )}`
      );
    });

    it('should format multiple tags correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: [{ key: 'ip' }, { key: 'hostname' }],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"splunkUID","queries":[{"query":"hostname=\\"hostname1\\" ip=\\"192.168.0.1\\"","refId":""}]}'
        )}`
      );
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        tags: [
          { key: 'service.name', value: 'service' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"splunkUID","queries":[{"query":"service=\\"serviceName\\" pod=\\"podName\\"","refId":""}]}'
        )}`
      );
    });
  });

  describe('should return metric link', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return { uid: 'prom1Uid', name: 'prom1', type: 'prometheus' } as unknown as DataSourceInstanceSettings;
        },
      } as unknown as DatasourceSrv);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('returns single query with span', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        traceToMetricsOptions: {
          datasourceUid: 'prom1Uid',
          queries: [{ query: 'customQuery' }],
        },
        trace: dummyTraceData,
        dataFrame: dummyDataFrame,
      });
      expect(createLink).toBeDefined();

      const links = createLink!(createTraceSpan());
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Metrics);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637080000","to":"1602637321000"},"datasource":"prom1Uid","queries":[{"expr":"customQuery","refId":"A"}]}'
        )}`
      );
    });

    it('returns nothing if no queries specified', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        traceToMetricsOptions: {
          datasourceUid: 'prom1',
        } as TraceToMetricsOptions,
        trace: dummyTraceData,
        dataFrame: dummyDataFrame,
      });
      expect(createLink).toBeDefined();

      const links = createLink!(createTraceSpan());
      expect(links).toBeDefined();
      expect(links?.length).toEqual(0);
    });

    it('returns multiple queries including default', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        traceToMetricsOptions: {
          datasourceUid: 'prom1Uid',
          queries: [
            { name: 'Named Query', query: 'customQuery' },
            { name: 'defaultQuery', query: '' },
            { query: 'no_name_here' },
          ],
        },
        trace: dummyTraceData,
        dataFrame: dummyDataFrame,
      });
      expect(createLink).toBeDefined();

      const links = createLink!(createTraceSpan());
      expect(links).toBeDefined();
      expect(links).toHaveLength(3);

      const namedLink = links?.[0];
      expect(namedLink).toBeDefined();
      expect(namedLink?.type).toBe(SpanLinkType.Metrics);
      expect(namedLink!.title).toBe('Named Query');
      expect(namedLink!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637080000","to":"1602637321000"},"datasource":"prom1Uid","queries":[{"expr":"customQuery","refId":"A"}]}'
        )}`
      );

      const defaultLink = links?.[1];
      expect(defaultLink).toBeDefined();
      expect(defaultLink?.type).toBe(SpanLinkType.Metrics);
      expect(defaultLink!.title).toBe('defaultQuery');
      expect(defaultLink!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637080000","to":"1602637321000"},"datasource":"prom1Uid","queries":[{"expr":"histogram_quantile(0.5, sum(rate(traces_spanmetrics_latency_bucket{service=\\"test service\\"}[5m])) by (le))","refId":"A"}]}'
        )}`
      );

      const unnamedQuery = links?.[2];
      expect(unnamedQuery).toBeDefined();
      expect(unnamedQuery?.type).toBe(SpanLinkType.Metrics);
      expect(unnamedQuery!.title).toBeUndefined();
      expect(unnamedQuery!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637080000","to":"1602637321000"},"datasource":"prom1Uid","queries":[{"expr":"no_name_here","refId":"A"}]}'
        )}`
      );
    });

    it('with adjusted start and end time', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        traceToMetricsOptions: {
          datasourceUid: 'prom1Uid',
          queries: [{ query: 'customQuery' }],
          spanStartTimeShift: '-1h',
          spanEndTimeShift: '1h',
        },
        trace: dummyTraceData,
        dataFrame: dummyDataFrame,
      });
      expect(createLink).toBeDefined();

      const links = createLink!(createTraceSpan());
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Metrics);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602633600000","to":"1602640801000"},"datasource":"prom1Uid","queries":[{"expr":"customQuery","refId":"A"}]}'
        )}`
      );
    });
  });

  it('correctly interpolates span attributes', () => {
    const splitOpenFn = jest.fn();
    const createLink = createSpanLinkFactory({
      splitOpenFn,
      traceToMetricsOptions: {
        datasourceUid: 'prom1Uid',
        queries: [{ name: 'Named Query', query: 'metric{$__tags, $__tags}[5m]' }],
        tags: [
          { key: 'job', value: '' },
          { key: 'k8s.pod', value: 'pod' },
        ],
      },
      trace: dummyTraceData,
      dataFrame: dummyDataFrame,
    });
    expect(createLink).toBeDefined();

    const links = createLink!(
      createTraceSpan({
        process: {
          serviceName: 'service',
          tags: [
            { key: 'job', value: 'tns/app' },
            { key: 'k8s.pod', value: 'sample-pod' },
          ],
        },
      })
    );
    expect(links).toBeDefined();
    expect(links![0].type).toBe(SpanLinkType.Metrics);
    expect(links![0].href).toBe(
      `/explore?left=${encodeURIComponent(
        '{"range":{"from":"1602637080000","to":"1602637321000"},"datasource":"prom1Uid","queries":[{"expr":"metric{job=\\"tns/app\\", pod=\\"sample-pod\\", job=\\"tns/app\\", pod=\\"sample-pod\\"}[5m]","refId":"A"}]}'
      )}`
    );
  });

  describe('should return span links', () => {
    beforeAll(() => {
      setDataSourceSrv(new DatasourceSrv());
      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('ignores parent span link', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({ references: [{ refType: 'CHILD_OF', spanID: 'parent', traceID: 'traceID' }] })
      );

      const traceLinks = links;
      expect(traceLinks).toBeDefined();
      expect(traceLinks).toHaveLength(0);
    });

    it('returns links for references and subsidiarilyReferencedBy references', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          references: [
            {
              refType: 'FOLLOWS_FROM',
              spanID: 'span1',
              traceID: 'traceID',
              span: { operationName: 'SpanName' } as TraceSpan,
            },
          ],
          subsidiarilyReferencedBy: [{ refType: 'FOLLOWS_FROM', spanID: 'span3', traceID: 'traceID2' }],
        })
      );

      const traceLinks = links;
      expect(traceLinks).toBeDefined();
      expect(traceLinks).toHaveLength(2);
      expect(traceLinks![0].type).toBe(SpanLinkType.Traces);
      expect(traceLinks![1].type).toBe(SpanLinkType.Traces);

      expect(traceLinks![0]).toEqual(
        expect.objectContaining({
          href: 'traceID-span1',
          title: 'SpanName',
        })
      );
      expect(traceLinks![1]).toEqual(
        expect.objectContaining({
          href: 'traceID2-span3',
          title: 'View linked span',
        })
      );
    });
  });

  describe('elasticsearch/opensearch link', () => {
    const searchUID = 'searchUID';

    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return {
            uid: searchUID,
            name: 'Elasticsearch',
            type: 'elasticsearch',
          } as unknown as DataSourceInstanceSettings;
        },
      } as unknown as DataSourceSrv);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('creates link with correct simple query', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: searchUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(decodeURIComponent(linkDef!.href)).toContain(
        `datasource":"${searchUID}","queries":[{"query":"cluster:\\"cluster1\\" AND hostname:\\"hostname1\\" AND service_namespace:\\"namespace1\\"","refId":"","metrics":[{"id":"1","type":"logs"}]}]`
      );
    });

    it('automatically timeshifts the time range by one second in a query', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: searchUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toContain(
        `${encodeURIComponent('{"range":{"from":"1602637200000","to":"1602637201000"}')}`
      );
      expect(linkDef!.href).not.toContain(
        `${encodeURIComponent('{"range":{"from":"1602637200000","to":"1602637200000"}')}`
      );
    });

    it('formats query correctly if filterByTraceID and or filterBySpanID is true', () => {
      const createLink = setupSpanLinkFactory(
        {
          datasourceUid: searchUID,
          filterByTraceID: true,
          filterBySpanID: true,
        },
        searchUID
      );

      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"${searchUID}","queries":[{"query":"\\"6605c7b08e715d6c\\" AND \\"7946b05c2e2e4e5a\\" AND cluster:\\"cluster1\\" AND hostname:\\"hostname1\\" AND service_namespace:\\"namespace1\\"","refId":"","metrics":[{"id":"1","type":"logs"}]}]}`
        )}`
      );
    });

    it('formats query correctly if only filterByTraceID is true', () => {
      const createLink = setupSpanLinkFactory(
        {
          datasourceUid: searchUID,
          filterByTraceID: true,
        },
        searchUID
      );

      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(decodeURIComponent(linkDef!.href)).toBe(
        `/explore?left={"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"searchUID","queries":[{"query":"\\"7946b05c2e2e4e5a\\"","refId":"","metrics":[{"id":"1","type":"logs"}]}]}`
      );
    });

    it('should format one tag correctly', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [{ key: 'ip' }],
        },
        searchUID
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [{ key: 'ip', value: '192.168.0.1' }],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"${searchUID}","queries":[{"query":"ip:\\"192.168.0.1\\"","refId":"","metrics":[{"id":"1","type":"logs"}]}]}`
        )}`
      );
    });

    it('should format multiple tags correctly', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [{ key: 'ip' }, { key: 'hostname' }],
        },
        searchUID
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"${searchUID}","queries":[{"query":"hostname:\\"hostname1\\" AND ip:\\"192.168.0.1\\"","refId":"","metrics":[{"id":"1","type":"logs"}]}]}`
        )}`
      );
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [
            { key: 'service.name', value: 'service' },
            { key: 'k8s.pod.name', value: 'pod' },
          ],
        },
        searchUID
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"${searchUID}","queries":[{"query":"service:\\"serviceName\\" AND pod:\\"podName\\"","refId":"","metrics":[{"id":"1","type":"logs"}]}]}`
        )}`
      );
    });
  });

  describe('google cloud link', () => {
    const searchUID = 'searchUID';

    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return {
            uid: searchUID,
            name: 'Google Cloud Logging',
            type: 'googlecloud-logging-datasource',
          } as unknown as DataSourceInstanceSettings;
        },
      } as unknown as DataSourceSrv);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('creates link with correct simple query', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: searchUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(decodeURIComponent(linkDef!.href)).toContain(
        `datasource":"${searchUID}","queries":[{"query":"cluster=\\"cluster1\\" AND hostname=\\"hostname1\\" AND service_namespace=\\"namespace1\\"","refId":""}]`
      );
    });

    it('automatically timeshifts the time range by one second in a query', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: searchUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toContain(
        `${encodeURIComponent('{"range":{"from":"1602637200000","to":"1602637201000"}')}`
      );
      expect(linkDef!.href).not.toContain(
        `${encodeURIComponent('{"range":{"from":"1602637200000","to":"1602637200000"}')}`
      );
    });

    it('formats query correctly if filterByTraceID and or filterBySpanID is true', () => {
      const createLink = setupSpanLinkFactory(
        {
          datasourceUid: searchUID,
          filterByTraceID: true,
          filterBySpanID: true,
        },
        searchUID
      );

      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"${searchUID}","queries":[{"query":"\\"6605c7b08e715d6c\\" AND \\"7946b05c2e2e4e5a\\" AND cluster=\\"cluster1\\" AND hostname=\\"hostname1\\" AND service_namespace=\\"namespace1\\"","refId":""}]}`
        )}`
      );
    });

    it('formats query correctly if only filterByTraceID is true', () => {
      const createLink = setupSpanLinkFactory(
        {
          datasourceUid: searchUID,
          filterByTraceID: true,
        },
        searchUID
      );

      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(decodeURIComponent(linkDef!.href)).toBe(
        `/explore?left={"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"searchUID","queries":[{"query":"\\"7946b05c2e2e4e5a\\"","refId":""}]}`
      );
    });

    it('should format one tag correctly', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [{ key: 'ip' }],
        },
        searchUID
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [{ key: 'ip', value: '192.168.0.1' }],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"${searchUID}","queries":[{"query":"ip=\\"192.168.0.1\\"","refId":""}]}`
        )}`
      );
    });

    it('should format multiple tags correctly', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [{ key: 'ip' }, { key: 'hostname' }],
        },
        searchUID
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"${searchUID}","queries":[{"query":"hostname=\\"hostname1\\" AND ip=\\"192.168.0.1\\"","refId":""}]}`
        )}`
      );
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [
            { key: 'service.name', value: 'service' },
            { key: 'k8s.pod.name', value: 'pod' },
          ],
        },
        searchUID
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          `{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"${searchUID}","queries":[{"query":"service=\\"serviceName\\" AND pod=\\"podName\\"","refId":""}]}`
        )}`
      );
    });
  });

  describe('custom query', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return { uid: 'loki1_uid', name: 'loki1', type: 'loki' } as unknown as DataSourceInstanceSettings;
        },
      } as unknown as DataSourceSrv);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('interpolates custom query correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: [
          { key: 'service.name', value: 'service' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
        customQuery: true,
        query: '{${__tags}} |="${__span.tags["service.name"]}" |="${__trace.traceId}"',
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(decodeURIComponent(linkDef!.href)).toContain(
        '"queries":' +
          JSON.stringify([{ expr: '{service="serviceName", pod="podName"} |="serviceName" |="trace1"', refId: '' }])
      );
    });

    it('does not return a link if variables are not matched', () => {
      const createLink = setupSpanLinkFactory({
        tags: [{ key: 'service.name', value: 'service' }],
        customQuery: true,
        query: '{${__tags}} |="${__span.tags["service.name"]}" |="${__trace.id}"',
      });
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());
      expect(links).toBeDefined();
      expect(links?.length).toEqual(0);
    });
  });

  describe('should return falconLogScale link', () => {
    const falconLogScaleUID = 'falconLogScaleUID';

    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return {
            uid: falconLogScaleUID,
            name: 'FalconLogScale',
            type: 'grafana-falconlogscale-datasource',
          } as unknown as DataSourceInstanceSettings;
        },
      } as unknown as DataSourceSrv);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('the `lsql` keyword is used in the link', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: falconLogScaleUID,
      });
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toContain(`${encodeURIComponent('datasource":"falconLogScaleUID","queries":[{"lsql"')}`);
    });

    it('formats query correctly if filterByTraceID and or filterBySpanID is true', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: falconLogScaleUID,
        filterByTraceID: true,
        filterBySpanID: true,
      });

      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"falconLogScaleUID","queries":[{"lsql":"cluster=\\"cluster1\\" OR hostname=\\"hostname1\\" OR service_namespace=\\"namespace1\\" or \\"7946b05c2e2e4e5a\\" or \\"6605c7b08e715d6c\\"","refId":""}]}'
        )}`
      );
    });

    it('should format one tag correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: [{ key: 'ip' }],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [{ key: 'ip', value: '192.168.0.1' }],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"falconLogScaleUID","queries":[{"lsql":"ip=\\"192.168.0.1\\"","refId":""}]}'
        )}`
      );
    });

    it('should format multiple tags correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: [{ key: 'ip' }, { key: 'hostname' }],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"falconLogScaleUID","queries":[{"lsql":"hostname=\\"hostname1\\" OR ip=\\"192.168.0.1\\"","refId":""}]}'
        )}`
      );
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        tags: [
          { key: 'service.name', value: 'service' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Logs);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"falconLogScaleUID","queries":[{"lsql":"service=\\"serviceName\\" OR pod=\\"podName\\"","refId":""}]}'
        )}`
      );
    });
  });

  describe('should return session link', () => {
    beforeAll(() => {
      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('does not add link when no ids are present', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());
      const sessionLink = links?.find((link) => link.type === SpanLinkType.Session);
      expect(sessionLink).toBe(undefined);
    });

    it('adds link when fe o11y ids are present', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'feo11y-service',
            tags: [{ key: 'gf.feo11y.app.id', value: 'appId' }],
          },
          tags: [{ key: 'session_id', value: 'the-session-id' }],
        })
      );
      expect(links).toHaveLength(1);
      const sessionLink = links?.find((link) => link.type === SpanLinkType.Session);
      expect(sessionLink).toBeDefined();
      expect(sessionLink!.href).toBe('/a/grafana-kowalski-app/apps/appId/sessions/the-session-id');
    });

    it('adds link when session id is defined following otel semantic convention', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'feo11y-service',
            tags: [{ key: 'gf.feo11y.app.id', value: 'appId' }],
          },
          tags: [{ key: 'session.id', value: 'the-otel-session-id' }],
        })
      );
      expect(links).toHaveLength(1);
      const sessionLink = links?.find((link) => link.type === SpanLinkType.Session);
      expect(sessionLink).toBeDefined();
      expect(sessionLink!.href).toBe('/a/grafana-kowalski-app/apps/appId/sessions/the-otel-session-id');
    });
  });

  describe('should return pyroscope link', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings() {
          return {
            uid: 'pyroscopeUid',
            name: 'pyroscope',
            type: 'grafana-pyroscope-datasource',
          } as unknown as DataSourceInstanceSettings;
        },
      } as unknown as DataSourceSrv);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('with default keys when tags not configured', () => {
      const createLink = setupSpanLinkFactory({}, '', dummyDataFrameForProfiles);
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Profiles);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637140000","to":"1602637261000"},"datasource":"pyroscopeUid","queries":[{"labelSelector":"{service_namespace=\\"namespace1\\"}","groupBy":[],"profileTypeId":"","queryType":"profile","spanSelector":["6605c7b08e715d6c"],"refId":""}]}'
        )}`
      );
    });

    it('with tags that passed in and without tags that are not in the span', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [{ key: 'ip' }, { key: 'newTag' }],
        },
        '',
        dummyDataFrameForProfiles
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Profiles);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637140000","to":"1602637261000"},"datasource":"pyroscopeUid","queries":[{"labelSelector":"{ip=\\"192.168.0.1\\"}","groupBy":[],"profileTypeId":"","queryType":"profile","spanSelector":["6605c7b08e715d6c"],"refId":""}]}'
        )}`
      );
    });

    it('from tags and process tags as well', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [{ key: 'ip' }, { key: 'host' }],
        },
        '',
        dummyDataFrameForProfiles
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'hostname', value: 'hostname1' },
              { key: 'ip', value: '192.168.0.1' },
            ],
          },
        })
      );
      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Profiles);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637140000","to":"1602637261000"},"datasource":"pyroscopeUid","queries":[{"labelSelector":"{ip=\\"192.168.0.1\\", host=\\"host\\"}","groupBy":[],"profileTypeId":"","queryType":"profile","spanSelector":["6605c7b08e715d6c"],"refId":""}]}'
        )}`
      );
    });

    it('creates link from dataFrame', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        dataFrame: createDataFrame({
          fields: [
            { name: 'traceID', values: ['testTraceId'] },
            {
              name: 'spanID',
              config: { links: [{ title: 'link', url: '${__data.fields.spanID}' }] },
              values: ['testSpanId'],
            },
          ],
        }),
        trace: dummyTraceData,
      });
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Unknown);
      expect(linkDef!.href).toBe('testSpanId');
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [
            { key: 'service.name', value: 'service' },
            { key: 'k8s.pod.name', value: 'pod' },
          ],
        },
        '',
        dummyDataFrameForProfiles
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Profiles);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637140000","to":"1602637261000"},"datasource":"pyroscopeUid","queries":[{"labelSelector":"{service=\\"serviceName\\", pod=\\"podName\\"}","groupBy":[],"profileTypeId":"","queryType":"profile","spanSelector":["6605c7b08e715d6c"],"refId":""}]}'
        )}`
      );
    });

    it('handles incomplete renamed tags', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [
            { key: 'service.name', value: '' },
            { key: 'k8s.pod.name', value: 'pod' },
          ],
        },
        '',
        dummyDataFrameForProfiles
      );
      expect(createLink).toBeDefined();
      const links = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [
              { key: 'service.name', value: 'serviceName' },
              { key: 'k8s.pod.name', value: 'podName' },
            ],
          },
        })
      );

      const linkDef = links?.[0];
      expect(linkDef).toBeDefined();
      expect(linkDef?.type).toBe(SpanLinkType.Profiles);
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"1602637140000","to":"1602637261000"},"datasource":"pyroscopeUid","queries":[{"labelSelector":"{service.name=\\"serviceName\\", pod=\\"podName\\"}","groupBy":[],"profileTypeId":"","queryType":"profile","spanSelector":["6605c7b08e715d6c"],"refId":""}]}'
        )}`
      );
    });

    it('interpolates span intrinsics', () => {
      const createLink = setupSpanLinkFactory(
        {
          tags: [{ key: 'name', value: 'spanName' }],
        },
        '',
        dummyDataFrameForProfiles
      );
      expect(createLink).toBeDefined();
      const links = createLink!(createTraceSpan());
      expect(links).toBeDefined();
      expect(links![0].type).toBe(SpanLinkType.Profiles);
      expect(decodeURIComponent(links![0].href)).toContain('spanName=\\"operation\\"');
    });
  });
});

describe('dataFrame links', () => {
  beforeAll(() => {
    setDataSourceSrv({
      getInstanceSettings() {
        return { uid: 'loki1_uid', name: 'loki1', type: 'loki' } as unknown as DataSourceInstanceSettings;
      },
    } as unknown as DataSourceSrv);

    setLinkSrv(new LinkSrv());
    setTemplateSrv(new TemplateSrv());
  });

  it('creates multiple span links for the dataframe links', () => {
    const multiLinkDataFrame = createMultiLinkDataFrame();
    const splitOpenFn = jest.fn();
    const createLink = createSpanLinkFactory({
      splitOpenFn,
      dataFrame: multiLinkDataFrame,
      trace: dummyTraceData,
    });

    const links = createLink!(createTraceSpan());
    expect(links).toBeDefined();
    expect(links?.length).toEqual(3);
    expect(links![0].href).toBe('testSpanId');
    expect(links![0].type).toBe(SpanLinkType.Unknown);
    expect(links![1].href).toBe(
      `/explore?left=${encodeURIComponent(
        '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"loki1_uid","queries":[{"message":"SELECT * FROM superhero WHERE name=host"}]}'
      )}`
    );
    expect(links![1].type).toBe(SpanLinkType.Unknown);
    expect(links![2].href).toBe(
      `/explore?left=${encodeURIComponent(
        '{"range":{"from":"1602637200000","to":"1602637201000"},"datasource":"loki1_uid","queries":[{"expr":"go_memstats_heap_inuse_bytes{job=\'host\'}"}]}'
      )}`
    );
    expect(links![2].type).toBe(SpanLinkType.Unknown);
  });
});

function setupSpanLinkFactory(
  options: Partial<TraceToLogsOptionsV2> = {},
  datasourceUid = 'lokiUid',
  dummyDataFrameForProfiles?: DataFrame
) {
  const splitOpenFn = jest.fn();
  return createSpanLinkFactory({
    splitOpenFn,
    traceToLogsOptions: {
      customQuery: false,
      datasourceUid,
      ...options,
    },
    traceToProfilesOptions: {
      customQuery: false,
      datasourceUid: 'pyroscopeUid',
      ...options,
    },
    createFocusSpanLink: (traceId, spanId) => {
      return {
        href: `${traceId}-${spanId}`,
      } as unknown as LinkModel;
    },
    trace: dummyTraceData,
    dataFrame: dummyDataFrameForProfiles ? dummyDataFrameForProfiles : dummyDataFrame,
  });
}

function createTraceSpan(overrides: Partial<TraceSpan> = {}) {
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
    tags: [
      {
        key: 'host',
        value: 'host',
      },
      {
        key: pyroscopeProfileIdTagKey,
        value: 'hdgfljn23u982nj',
      },
    ],
    process: {
      serviceName: 'test service',
      tags: [
        {
          key: 'cluster',
          value: 'cluster1',
        },
        {
          key: 'hostname',
          value: 'hostname1',
        },
        {
          key: 'label2',
          value: 'val2',
        },
        {
          key: 'service.namespace',
          value: 'namespace1',
        },
      ],
    },
    ...overrides,
  } as TraceSpan;
}

function createMultiLinkDataFrame() {
  return createDataFrame({
    fields: [
      { name: 'traceID', values: ['testTraceId'] },
      {
        name: 'spanID',
        config: { links: [{ title: 'link', url: '${__data.fields.spanID}' }] },
        values: ['testSpanId'],
      },
      {
        name: 'tags',
        type: FieldType.other,
        config: {
          links: [
            {
              internal: {
                query: {
                  message: 'SELECT * FROM superhero WHERE name=${job}',
                },
                datasourceUid: 'loki1_uid',
                datasourceName: 'loki1',
              },
              url: '',
              title: 'Test',
              origin: DataLinkConfigOrigin.Correlations,
              meta: {
                transformations: [
                  {
                    type: SupportedTransformationType.Regex,
                    expression: '{(?=[^\\}]*\\bkey":"host")[^\\}]*\\bvalue":"(.*?)".*}',
                    mapValue: 'job',
                  },
                ],
              },
            },
            {
              internal: {
                query: {
                  expr: "go_memstats_heap_inuse_bytes{job='${job}'}",
                },
                datasourceUid: 'loki1_uid',
                datasourceName: 'loki1',
              },
              url: '',
              title: 'Test',
              origin: DataLinkConfigOrigin.Correlations,
              meta: {
                transformations: [
                  {
                    type: SupportedTransformationType.Regex,
                    expression: '{(?=[^\\}]*\\bkey":"host")[^\\}]*\\bvalue":"(.*?)".*}',
                    mapValue: 'job',
                  },
                ],
              },
            },
          ],
        },
        values: [
          {
            key: 'host',
            value: 'host',
          },
        ],
      },
    ],
  });
}
