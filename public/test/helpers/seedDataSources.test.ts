import { type DataSourceApi, type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';
// Seeding the legacy service is part of this util's contract while DataSourceSrv still exists,
// so reading it back is the only way to assert that half. Delete with the legacySrv option.
// eslint-disable-next-line @grafana/no-get-data-source-srv
import { getDataSourceSrv, setDataSourceSrv, type DataSourceSrv } from '@grafana/runtime';
import { getDatasourcePluginMeta } from '@grafana/runtime/internal';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { seedDataSources, watchDataSourceFallbacks } from './seedDataSources';

function makeFixture(name: string, uid: string, api?: Partial<DataSourceApi>) {
  const meta = { id: name, name, type: 'datasource', module: '', baseUrl: '', logs: true } as DataSourcePluginMeta;
  const settings = { uid, name, type: name, meta, access: 'proxy', jsonData: {}, readOnly: false };

  return {
    settings: settings as DataSourceInstanceSettings,
    api: { uid, name, components: {}, ...api } as DataSourceApi,
  };
}

describe('seedDataSources', () => {
  it('resolves distinct instances and components for two datasources sharing a plugin', async () => {
    const first = makeFixture('First', 'first-uid', { components: { QueryEditor: () => null } });
    const second = makeFixture('Second', 'second-uid', { components: { QueryEditor: () => null } });
    first.settings.meta = { ...first.settings.meta, id: 'loki' };
    second.settings.meta = { ...first.settings.meta };
    first.settings.type = 'loki';
    second.settings.type = 'loki';
    const firstComponents = first.api.components;
    const secondComponents = second.api.components;
    seedDataSources([first, second], { legacySrv: 'none' });
    const fallbacks = watchDataSourceFallbacks();

    const [firstResult, secondResult] = await Promise.all([
      getDataSourceInstance('first-uid'),
      getDataSourceInstance('second-uid'),
    ]);

    expect(firstResult).toBe(first.api);
    expect(secondResult).toBe(second.api);
    expect(firstResult.uid).toBe('first-uid');
    expect(secondResult.uid).toBe('second-uid');
    expect(firstResult.components).toBe(firstComponents);
    expect(secondResult.components).toBe(secondComponents);
    fallbacks.expectNoFallbacks(['instance', 'settings']);
  });

  it('seeds built-in plugin metadata and alias mappings', async () => {
    const grafana = makeFixture('-- Grafana --', 'grafana-uid');
    grafana.settings.type = 'datasource';
    grafana.settings.meta.id = 'grafana';
    const loki = makeFixture('Loki', 'loki-uid');
    loki.settings.type = 'loki';
    loki.settings.meta.id = 'loki';
    loki.settings.meta.aliasIDs = ['loki-alias'];
    seedDataSources([grafana, loki], { legacySrv: 'none' });

    expect(await getDatasourcePluginMeta('grafana')).toEqual(grafana.settings.meta);
    expect(await getDatasourcePluginMeta('loki-alias')).toEqual(loki.settings.meta);
    expect(await getDataSourceInstance('grafana-uid')).toBe(grafana.api);
    expect(await getDataSourceInstance('loki-uid')).toBe(loki.api);
  });

  it('reports the missing instance fixture even when another instance shares its plugin', async () => {
    const first = makeFixture('First', 'first-uid');
    const missing = { ...first.settings, uid: 'missing-uid', name: 'Missing' };
    seedDataSources([first, missing], { legacySrv: 'none' });

    await expect(getDataSourceInstance('missing-uid')).rejects.toThrow(
      'seedDataSources: no api fixture for data source "missing-uid" (plugin "First"). Seed it as { settings, api }.'
    );
  });

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
