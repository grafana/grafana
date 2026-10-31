import { type DataSourcePluginMeta } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../../../config';
import { FlagKeys } from '../../../internal/openFeature/openfeature.gen';
import { type BackendSrv, setBackendSrv } from '../../backendSrv';
import { setLogger } from '../../logging/registry';
import { setDatasourcePluginMetas } from '../../pluginMeta/datasources';
import { MT_FILL_PREREQUISITES_MISSING_WARNING } from '../constants';

import { createDataSourceCacheSource, isMTDataSourceFillEnabled } from './selectSource';

const boot = { datasources: {}, defaultDatasource: '' };
const allFlags = {
  [FlagKeys.PluginsInitDataSourcesAsync]: true,
  [FlagKeys.QueryService]: true,
  [FlagKeys.QueryServiceWithConnections]: true,
  [FlagKeys.PluginsUseMTPlugins]: true,
  [FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs]: true,
};
const logWarning = jest.fn();

beforeEach(() => {
  logWarning.mockClear();
  setLogger('grafana/runtime.plugins.datasource', {
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning,
  });
  setTestFlags(allFlags);
  config.publicDashboardAccessToken = undefined;
});

afterAll(() => {
  setTestFlags({});
});

describe('createDataSourceCacheSource', () => {
  it('selects the MT source when the toggle and every prerequisite are on', () => {
    expect(createDataSourceCacheSource(boot).kind).toBe('mt');
    expect(isMTDataSourceFillEnabled()).toBe(true);
    expect(logWarning).not.toHaveBeenCalled();
  });

  it('accepts grafanaAPIServerWithExperimentalAPIs instead of queryService', () => {
    setTestFlags({
      ...allFlags,
      [FlagKeys.QueryService]: false,
      [FlagKeys.GrafanaAPIServerWithExperimentalAPIs]: true,
    });

    expect(createDataSourceCacheSource(boot).kind).toBe('mt');
  });

  it('selects boot data without a warning when plugins.initDataSourcesAsync is off', () => {
    setTestFlags({ ...allFlags, [FlagKeys.PluginsInitDataSourcesAsync]: false });

    expect(createDataSourceCacheSource(boot).kind).toBe('bootData');
    expect(isMTDataSourceFillEnabled()).toBe(false);
    expect(logWarning).not.toHaveBeenCalled();
  });

  it('selects boot data without a warning in a public dashboard view', () => {
    config.publicDashboardAccessToken = 'token';

    expect(createDataSourceCacheSource(boot).kind).toBe('bootData');
    expect(logWarning).not.toHaveBeenCalled();
  });

  // The connections endpoint is legacy-backed, so reading the per-plugin groups is the only way to
  // see a data source that lives only in unified storage. It costs a request per plugin, so it is
  // opt-in rather than the default. `kind` is 'mt' either way, so assert which endpoint is read.
  it.each([
    { flag: false, url: 'apis/query.grafana.app/v0alpha1/namespaces/default/connections' },
    { flag: true, url: 'apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources' },
  ])('lists from $url when datasources.listFromApiGroups is $flag', async ({ flag, url }) => {
    config.namespace = 'default';
    setTestFlags({ ...allFlags, [FlagKeys.DatasourcesListFromApiGroups]: flag });
    const get = jest.fn().mockResolvedValue({ items: [] });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    setBackendSrv({ get } as unknown as BackendSrv);
    setDatasourcePluginMetas([
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { id: 'prometheus', name: 'Prometheus', type: 'datasource' } as DataSourcePluginMeta,
    ]);

    await createDataSourceCacheSource(boot).loadList();

    expect(get).toHaveBeenCalledWith(url, undefined, expect.any(String), expect.anything());
  });

  // The connections endpoint is legacy-backed, so reading the per-plugin groups is the only way to
  // see a data source that lives only in unified storage. It costs a request per plugin, so it is
  // opt-in rather than the default.
  it('reads the per-plugin API groups only when the flag is on', () => {
    setTestFlags({ ...allFlags, [FlagKeys.DatasourcesListFromApiGroups]: true });
    expect(createDataSourceCacheSource(boot).kind).toBe('mt');

    setTestFlags(allFlags);
    expect(createDataSourceCacheSource(boot).kind).toBe('mt');
  });

  it.each([
    {
      missing: 'queryService|grafanaAPIServerWithExperimentalAPIs',
      setup: () => setTestFlags({ ...allFlags, [FlagKeys.QueryService]: false }),
    },
    {
      missing: FlagKeys.QueryServiceWithConnections,
      setup: () => setTestFlags({ ...allFlags, [FlagKeys.QueryServiceWithConnections]: false }),
    },
    {
      missing: FlagKeys.PluginsUseMTPlugins,
      setup: () => setTestFlags({ ...allFlags, [FlagKeys.PluginsUseMTPlugins]: false }),
    },
    {
      missing: FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs,
      setup: () => setTestFlags({ ...allFlags, [FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs]: false }),
    },
  ])('selects boot data and names $missing when that prerequisite is off', ({ missing, setup }) => {
    setup();

    expect(createDataSourceCacheSource(boot).kind).toBe('bootData');
    expect(isMTDataSourceFillEnabled()).toBe(false);
    expect(logWarning).toHaveBeenCalledWith(MT_FILL_PREREQUISITES_MISSING_WARNING, { missing });
  });
});
