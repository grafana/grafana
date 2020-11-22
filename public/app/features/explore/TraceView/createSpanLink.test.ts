import { createSpanLinkFactory } from './createSpanLink';
import { config, setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';

describe('createSpanLinkFactory', () => {
  beforeAll(() => {
    config.featureToggles.traceToLogs = true;
  });

  afterAll(() => {
    config.featureToggles.traceToLogs = false;
  });

  it('returns undefined if there is no loki data source', () => {
    setDataSourceSrv({
      getExternal() {
        return [
          {
            meta: {
              id: 'not loki',
            },
          } as DataSourceInstanceSettings,
        ];
      },
    } as any);
    const splitOpenFn = jest.fn();
    const createLink = createSpanLinkFactory(splitOpenFn);
    expect(createLink).not.toBeDefined();
  });

  it('creates correct link', () => {
    setDataSourceSrv({
      getExternal() {
        return [
          {
            name: 'loki1',
            uid: 'lokiUid',
            meta: {
              id: 'loki',
            },
          } as DataSourceInstanceSettings,
        ];
      },
      getDataSourceSettingsByUid(uid: string): DataSourceInstanceSettings | undefined {
        if (uid === 'lokiUid') {
          return {
            name: 'Loki1',
          } as any;
        }
        return undefined;
      },
    } as any);

    setTemplateSrv({
      replace(target?: string, scopedVars?: ScopedVars, format?: string | Function): string {
        return target!;
      },
    } as any);

    const splitOpenFn = jest.fn();
    const createLink = createSpanLinkFactory(splitOpenFn);
    expect(createLink).toBeDefined();
    const linkDef = createLink!({
      startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
      duration: 1000 * 1000,
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
      `/explore?left={"range":{"from":"20201014T000000","to":"20201014T010006"},"datasource":"Loki1","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\"}","refId":""}]}`
    );
  });
});
