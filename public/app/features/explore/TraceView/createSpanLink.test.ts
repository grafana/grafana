import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { createSpanLinkFactory } from './createSpanLink';

describe('createSpanLinkFactory', () => {
  it('returns undefined if there is no data source uid', () => {
    const splitOpenFn = jest.fn();
    const createLink = createSpanLinkFactory(splitOpenFn);
    expect(createLink).not.toBeDefined();
  });

  describe('should return link', () => {
    beforeAll(() => {
      setDataSourceSrv({
        getInstanceSettings(uid: string): DataSourceInstanceSettings | undefined {
          return {
            uid: 'loki1',
            name: 'loki1',
          } as any;
        },
      } as any);

      setTemplateSrv({
        replace(target?: string, scopedVars?: ScopedVars, format?: string | Function): string {
          return target!;
        },
      } as any);
    });

    it('with default keys when tags not configured', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory(splitOpenFn, { datasourceUid: 'lokiUid' });
      expect(createLink).toBeDefined();
      const linkDef = createLink!({
        startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
        duration: 1000 * 1000,
        tags: [
          {
            key: 'host',
            value: 'host',
          },
        ],
        process: {
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
        } as any,
      } as any);

      expect(linkDef.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\"}","refId":""}]}'
        )}`
      );
    });

    it('with tags that passed in and without tags that are not in the span', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory(splitOpenFn, { datasourceUid: 'lokiUid', tags: ['ip', 'newTag'] });
      expect(createLink).toBeDefined();
      const linkDef = createLink!({
        startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
        duration: 1000 * 1000,
        tags: [
          {
            key: 'host',
            value: 'host',
          },
        ],
        process: {
          tags: [
            {
              key: 'hostname',
              value: 'hostname1',
            },
            {
              key: 'ip',
              value: '192.168.0.1',
            },
          ],
        } as any,
      } as any);

      expect(linkDef.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{ip=\\"192.168.0.1\\"}","refId":""}]}'
        )}`
      );
    });

    it('from tags and process tags as well', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory(splitOpenFn, {
        datasourceUid: 'lokiUid',
        tags: ['ip', 'host'],
      });
      expect(createLink).toBeDefined();
      const linkDef = createLink!({
        startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
        duration: 1000 * 1000,
        tags: [
          {
            key: 'host',
            value: 'host',
          },
        ],
        process: {
          tags: [
            {
              key: 'hostname',
              value: 'hostname1',
            },
            {
              key: 'ip',
              value: '192.168.0.1',
            },
          ],
        } as any,
      } as any);

      expect(linkDef.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{ip=\\"192.168.0.1\\", host=\\"host\\"}","refId":""}]}'
        )}`
      );
    });

    it('with adjusted start and end time', () => {
      const splitOpenFn = jest.fn();
      const createLink = createSpanLinkFactory(splitOpenFn, {
        datasourceUid: 'lokiUid',
        spanStartTimeShift: '1m',
        spanEndTimeShift: '1m',
      });

      expect(createLink).toBeDefined();
      const linkDef = createLink!({
        startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
        duration: 1000 * 1000,
        tags: [
          {
            key: 'host',
            value: 'host',
          },
        ],
        process: {
          tags: [
            {
              key: 'hostname',
              value: 'hostname1',
            },
            {
              key: 'ip',
              value: '192.168.0.1',
            },
          ],
        } as any,
      } as any);

      expect(linkDef.href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"2020-10-14T01:01:00.000Z","to":"2020-10-14T01:01:01.000Z"},"datasource":"loki1","queries":[{"expr":"{hostname=\\"hostname1\\"}","refId":""}]}'
        )}`
      );
    });
  });
});
