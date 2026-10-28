import { type CurrentUserDTO, OrgRole } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../../../config';
import { FlagKeys } from '../../../internal/openFeature/openfeature.gen';
import { setLogger } from '../../logging/registry';
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
const originalUser = config.bootData.user;

function setBootUser(user: Partial<CurrentUserDTO>) {
  config.bootData.user = user as CurrentUserDTO;
}

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
  setBootUser({ isSignedIn: true, orgRole: OrgRole.Admin });
});

afterAll(() => {
  setTestFlags({});
  config.bootData.user = originalUser;
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

  it('selects the no-session source when there is no user session', () => {
    setBootUser({ isSignedIn: false, orgRole: '' });

    expect(createDataSourceCacheSource(boot).kind).toBe('noSession');
    expect(logWarning).not.toHaveBeenCalled();
  });

  it('selects the MT source for an anonymous user', () => {
    setBootUser({ isSignedIn: false, orgRole: OrgRole.Viewer });

    expect(createDataSourceCacheSource(boot).kind).toBe('mt');
  });

  it('selects boot data in a public dashboard view without a user session', () => {
    setBootUser({ isSignedIn: false, orgRole: '' });
    config.publicDashboardAccessToken = 'token';

    expect(createDataSourceCacheSource(boot).kind).toBe('bootData');
  });

  it('selects boot data without a user session when a prerequisite is off', () => {
    setBootUser({ isSignedIn: false, orgRole: '' });
    setTestFlags({ ...allFlags, [FlagKeys.PluginsUseMTPlugins]: false });

    expect(createDataSourceCacheSource(boot).kind).toBe('bootData');
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
