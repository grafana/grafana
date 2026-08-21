import { type DataSourceApi, type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';
import { getDataSourceSrv, setDataSourceSrv, type DataSourceSrv } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { seedDataSources, watchDataSourceFallbacks } from './seedDataSources';

function makeFixture(name: string, uid: string, api?: Partial<DataSourceApi>) {
  const meta = { id: name, name, type: 'datasource', module: '', baseUrl: '', logs: true } as DataSourcePluginMeta;
  const settings = { uid, name, type: 'logs', meta, access: 'proxy', jsonData: {}, readOnly: false };

  return {
    settings: settings as DataSourceInstanceSettings,
    api: { uid, name, components: {}, ...api } as DataSourceApi,
  };
}

describe('seedDataSources', () => {
  it('resolves an instance through the async API rather than the legacy fallback', async () => {
    const loki = makeFixture('loki', 'loki-uid', { query: jest.fn() });
    seedDataSources([loki], { legacySrv: 'mock' });
    const fallbacks = watchDataSourceFallbacks();

    await expect(getDataSourceInstance('loki-uid')).resolves.toBe(loki.api);
    await expect(getDataSourceInstanceSettings('loki-uid')).resolves.toBe(loki.settings);
    expect(() => fallbacks.expectNoFallbacks(['instance', 'settings', 'list'])).not.toThrow();
  });

  it('resolves the same instance through the legacy service', async () => {
    const loki = makeFixture('loki', 'loki-uid');
    seedDataSources([loki], { legacySrv: 'mock' });

    await expect(getDataSourceSrv().get('loki-uid')).resolves.toBe(loki.api);
    await expect(getDataSourceSrv().get({ uid: 'loki-uid' })).resolves.toBe(loki.api);
    expect(getDataSourceSrv().getInstanceSettings('loki')).toBe(loki.settings);
  });

  it('keeps the fixture components on the constructed instance', async () => {
    const components = { QueryEditor: () => null };
    const loki = makeFixture('loki', 'loki-uid', { components });
    seedDataSources([loki], { legacySrv: 'mock' });

    const instance = await getDataSourceInstance('loki-uid');
    expect(instance.components).toBe(components);
  });

  it('resolves the default data source for an empty ref', async () => {
    const loki = makeFixture('loki', 'loki-uid');
    const elastic = makeFixture('elastic', 'elastic-uid');
    elastic.settings.isDefault = true;
    seedDataSources([loki, elastic], { legacySrv: 'mock' });

    await expect(getDataSourceInstance()).resolves.toBe(elastic.api);
    await expect(getDataSourceSrv().get()).resolves.toBe(elastic.api);
  });

  it('hands back the instance from the latest seeding, not a cached one', async () => {
    seedDataSources([makeFixture('loki', 'loki-uid')], { legacySrv: 'mock' });
    await getDataSourceInstance('loki-uid');

    const reseeded = makeFixture('loki', 'loki-uid');
    seedDataSources([reseeded], { legacySrv: 'mock' });

    await expect(getDataSourceInstance('loki-uid')).resolves.toBe(reseeded.api);
  });

  it('fails a lookup instead of falling back when no legacy service is seeded', async () => {
    seedDataSources([makeFixture('loki', 'loki-uid')], { legacySrv: 'none' });
    const fallbacks = watchDataSourceFallbacks();

    await expect(getDataSourceInstance('missing-uid')).rejects.toThrow();
    expect(() => fallbacks.expectNoFallbacks(['instance', 'settings', 'list'])).not.toThrow();
  });
});

describe('watchDataSourceFallbacks', () => {
  it('reports a lookup that only the legacy service could resolve', async () => {
    const loki = makeFixture('loki', 'loki-uid');
    const legacyOnly: DataSourceSrv = {
      get: () => Promise.resolve(loki.api!),
      getInstanceSettings: () => loki.settings,
      getList: () => [loki.settings],
      reload: jest.fn(),
      registerRuntimeDataSource: jest.fn(),
    };
    // Nothing in the new registries, everything in the legacy service: the shape this util exists
    // to remove.
    seedDataSources([], { legacySrv: 'none' });
    setDataSourceSrv(legacyOnly);
    const fallbacks = watchDataSourceFallbacks();

    await expect(getDataSourceInstance('loki-uid')).resolves.toBe(loki.api);
    expect(() => fallbacks.expectNoFallbacks()).toThrow(/legacy DataSourceSrv fallback/);
  });
});
