import { type CurrentUserDTO } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../../../config';
import { FlagKeys } from '../../../internal/openFeature/openfeature.gen';
import { invalidateCachedPromisesCache } from '../../../utils/getCachedPromise';
import { type BackendSrv, setBackendSrv } from '../../backendSrv';
import { type DataSourceSrv, setDataSourceSrv } from '../../dataSourceSrv';
import { setLogger } from '../../logging/registry';
import { NoUserSessionError } from '../../user';
import {
  _resetForTests,
  getDataSourceInstanceList,
  getDataSourceInstanceSettings,
  initDataSourceInstanceSettings,
  syncDataSourceInstanceSettings,
} from '../settings';

const backendGet = jest.fn();
const fetchSpy = jest.fn();
const logError = jest.fn();
const cachedPromiseLogError = jest.fn();
const originalUser = config.bootData.user;
const originalFetch = global.fetch;

function testLogger(error: jest.Mock) {
  return { logDebug: jest.fn(), logError: error, logInfo: jest.fn(), logMeasurement: jest.fn(), logWarning: jest.fn() };
}

beforeAll(() => {
  setTestFlags({
    [FlagKeys.PluginsInitDataSourcesAsync]: true,
    [FlagKeys.QueryService]: true,
    [FlagKeys.QueryServiceWithConnections]: true,
    [FlagKeys.PluginsUseMTPlugins]: true,
    [FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs]: true,
  });
  setBackendSrv({ get: backendGet } as unknown as BackendSrv);
  global.fetch = fetchSpy;
});

afterAll(() => {
  setTestFlags({});
  config.bootData.user = originalUser;
  global.fetch = originalFetch;
});

beforeEach(() => {
  _resetForTests();
  invalidateCachedPromisesCache();
  backendGet.mockClear();
  fetchSpy.mockClear();
  logError.mockClear();
  cachedPromiseLogError.mockClear();
  setLogger('grafana/runtime.plugins.datasource', testLogger(logError));
  setLogger('grafana/runtime.utils.getCachedPromise', testLogger(cachedPromiseLogError));
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
  config.namespace = 'default';
  config.publicDashboardAccessToken = undefined;
  config.bootData.user = { isSignedIn: false, orgRole: '' } as CurrentUserDTO;
});

describe('without a user session', () => {
  it('rejects list lookups with NoUserSessionError', async () => {
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstanceList()).rejects.toBeInstanceOf(NoUserSessionError);
  });

  it('rejects settings lookups with NoUserSessionError', async () => {
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstanceSettings('uid-prom')).rejects.toBeInstanceOf(NoUserSessionError);
  });

  it('sends no request and logs no error, at boot or on a lookup', async () => {
    initDataSourceInstanceSettings({}, '');
    await getDataSourceInstanceList().catch(() => {});

    expect(backendGet).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    expect(cachedPromiseLogError).not.toHaveBeenCalled();
  });

  it('keeps the sync after a data source change quiet', async () => {
    initDataSourceInstanceSettings({}, '');

    await expect(syncDataSourceInstanceSettings({ datasources: {}, defaultDatasource: '' })).resolves.toBeUndefined();
    expect(backendGet).not.toHaveBeenCalled();
  });
});
