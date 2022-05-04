import { DataSourceInstanceSettings, MutableDataFrame } from '@grafana/data';
import { setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { TraceSpan } from '@jaegertracing/jaeger-ui-components';

import { TraceToLogsOptions } from '../../../core/components/TraceToLogs/TraceToLogsSettings';
import { LinkSrv, setLinkSrv } from '../../panel/panellinks/link_srv';
import { TemplateSrv } from '../../templating/template_srv';

import { createSpanLinkFactory } from './createSpanLink';

describe('createSpanLinkFactory', () => {
  it('returns undefined if there is no data source uid', () => {
    const splitOpenFn = jest.fn();
    const createLink = createSpanLinkFactory({ splitOpenFn: splitOpenFn });
    expect(createLink).not.toBeDefined();
  });

  describe('should return loki link', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings(uid: string): DataSourceInstanceSettings | undefined {
          return { uid: 'loki1', name: 'loki1', type: 'loki' } as any;
        },
      } as any);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('with default keys when tags not configured', () => {
      const createLink = setupSpanLinkFactory();
      expect(createLink).toBeDefined();
      const linkDef = createLink!(createTraceSpan());
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('with tags that passed in and without tags that are not in the span', () => {
      const createLink = setupSpanLinkFactory({
        tags: ['ip', 'newTag'],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
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
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{ip=\\"192.168.0.1\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('from tags and process tags as well', () => {
      const createLink = setupSpanLinkFactory({
        tags: ['ip', 'host'],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
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
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{ip=\\"192.168.0.1\\", host=\\"host\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('with adjusted start and end time', () => {
      const createLink = setupSpanLinkFactory({
        spanStartTimeShift: '1m',
        spanEndTimeShift: '1m',
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
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
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:01:00.000Z","to":"2020-10-14T01:01:01.000Z"},"datasource":"loki1","queries":[{"expr":"{hostname=\\"hostname1\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('filters by trace and span ID', () => {
      const createLink = setupSpanLinkFactory({
        filterBySpanID: true,
        filterByTraceID: true,
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(createTraceSpan());

      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\"} |=\\"7946b05c2e2e4e5a\\" |=\\"6605c7b08e715d6c\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('creates link from dataFrame', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory({
        splitOpenFn,
        dataFrame: new MutableDataFrame({
          fields: [
            { name: 'traceID', values: ['testTraceId'] },
            {
              name: 'spanID',
              config: { links: [{ title: 'link', url: '${__data.fields.spanID}' }] },
              values: ['testSpanId'],
            },
          ],
        }),
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(createTraceSpan());

      expect(linkDef!.href).toBe('testSpanId');
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        mapTagNamesEnabled: true,
        mappedTags: [
          { key: 'service.name', value: 'service' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
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
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{service=\\"serviceName\\", pod=\\"podName\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('handles incomplete renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        mapTagNamesEnabled: true,
        mappedTags: [
          { key: 'service.name', value: '' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
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
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{service.name=\\"serviceName\\", pod=\\"podName\\"}","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('handles empty queries', () => {
      const createLink = setupSpanLinkFactory({
        tags: [],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
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
      expect(linkDef).toBeUndefined();
    });
  });

  describe('should return splunk link', () => {
    const splunkUID = 'splunkUID';

    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings(uid: string): DataSourceInstanceSettings | undefined {
          return { uid: splunkUID, name: 'Splunk 8', type: 'grafana-splunk-datasource' } as any;
        },
      } as any);

      setLinkSrv(new LinkSrv());
      setTemplateSrv(new TemplateSrv());
    });

    it('the `query` keyword is used in the link rather than `expr` that loki uses', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
      });
      const linkDef = createLink!(createTraceSpan());
      expect(linkDef!.href).toContain(`${encodeURIComponent('datasource":"Splunk 8","queries":[{"query"')}`);
      expect(linkDef!.href).not.toContain(`${encodeURIComponent('datasource":"Splunk 8","queries":[{"expr"')}`);
    });

    it('automatically timeshifts the timerange by one second in a splunk query', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
      });
      const linkDef = createLink!(createTraceSpan());
      expect(linkDef!.href).toContain(
        `${encodeURIComponent('{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"}')}`
      );
      expect(linkDef!.href).not.toContain(
        `${encodeURIComponent('{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:00.000Z"}')}`
      );
    });

    it('formats query correctly if filterByTraceID and or filterBySpanID is true', () => {
      const createLink = setupSpanLinkFactory({
        datasourceUid: splunkUID,
        filterByTraceID: true,
        filterBySpanID: true,
      });

      expect(createLink).toBeDefined();
      const linkDef = createLink!(createTraceSpan());

      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"Splunk 8","queries":[{"query":"cluster=\\"cluster1\\" hostname=\\"hostname1\\" \\"7946b05c2e2e4e5a\\" \\"6605c7b08e715d6c\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('should format one tag correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: ['ip'],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
        createTraceSpan({
          process: {
            serviceName: 'service',
            tags: [{ key: 'ip', value: '192.168.0.1' }],
          },
        })
      );

      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"Splunk 8","queries":[{"query":"ip=\\"192.168.0.1\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('should format multiple tags correctly', () => {
      const createLink = setupSpanLinkFactory({
        tags: ['ip', 'hostname'],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
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

      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"Splunk 8","queries":[{"query":"hostname=\\"hostname1\\" ip=\\"192.168.0.1\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });

    it('handles renamed tags', () => {
      const createLink = setupSpanLinkFactory({
        mapTagNamesEnabled: true,
        mappedTags: [
          { key: 'service.name', value: 'service' },
          { key: 'k8s.pod.name', value: 'pod' },
        ],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!(
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
      expect(linkDef!.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"Splunk 8","queries":[{"query":"service=\\"serviceName\\" pod=\\"podName\\"","refId":""}],"panelsState":{}}'
        )}`
      );
    });
  });
});

function setupSpanLinkFactory(options: Partial<TraceToLogsOptions> = {}, datasourceUid = 'lokiUid') {
  const splitOpenFn = jest.fn();
  return createSpanLinkFactory({
    splitOpenFn,
    traceToLogsOptions: {
      datasourceUid,
      ...options,
    },
  });
}

function createTraceSpan(overrides: Partial<TraceSpan> = {}): TraceSpan {
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
      ],
    },
    ...overrides,
  } as any;
}
