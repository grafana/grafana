import { type CurrentUserDTO, OrgRole } from '@grafana/data';
import { type BackendSrv, config, getAPIGroup, invalidateAPIDiscovery, setBackendSrv } from '@grafana/runtime';
import { setAPIDiscoveryForTesting } from '@grafana/runtime/internal';

import { installPlugin, uninstallPlugin } from '../api';
import { PluginStatus } from '../types';

import { install, uninstall } from './actions';

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  installPlugin: jest.fn(),
  uninstallPlugin: jest.fn(),
}));

jest.mock('../../datasource_srv', () => ({
  getDatasourceSrv: () => ({ reload: jest.fn() }),
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  refetchPluginMetasAfterPluginChange: jest.fn(),
}));

const installPluginMock = jest.mocked(installPlugin);
const uninstallPluginMock = jest.mocked(uninstallPlugin);
const backendGet = jest.fn();
const originalUser = config.bootData.user;

const pluginId = 'myorg-test-app';
const cachedGroup = { group: pluginId, versions: ['v0alpha1'], preferredVersion: 'v0alpha1' };
const serverGroupList = {
  groups: [
    {
      name: pluginId,
      versions: [{ groupVersion: `${pluginId}/v1`, version: 'v1' }],
      preferredVersion: { groupVersion: `${pluginId}/v1`, version: 'v1' },
    },
  ],
};

type Routes = Record<string, () => Promise<unknown>>;

const defaultRoutes: Routes = {
  '/api/frontend/settings': () => Promise.resolve({}),
  '/apis': () => Promise.resolve(serverGroupList),
};

function respondTo(overrides: Routes = {}) {
  const routes = { ...defaultRoutes, ...overrides };
  backendGet.mockImplementation((url: string) => {
    const route = routes[url];
    return route ? route() : Promise.reject(new Error(`unexpected request to ${url}`));
  });
}

// The cache and the server disagree on the preferred version, so the answer shows which one discovery used.
async function discoveredPreferredVersion(): Promise<string | undefined> {
  return (await getAPIGroup(pluginId))?.preferredVersion;
}

function runInstall(installType: PluginStatus) {
  return install({ id: pluginId, version: '1.0.0', installType })(jest.fn(), jest.fn(), undefined);
}

function runUninstall() {
  return uninstall(pluginId)(jest.fn(), jest.fn(), undefined);
}

describe('plugin catalog actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    config.bootData.user = { isSignedIn: true, orgRole: OrgRole.Admin } as CurrentUserDTO;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    setBackendSrv({ get: backendGet } as unknown as BackendSrv);
    respondTo();
    installPluginMock.mockResolvedValue(undefined);
    uninstallPluginMock.mockResolvedValue(undefined);
    setAPIDiscoveryForTesting([cachedGroup]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    invalidateAPIDiscovery();
  });

  afterAll(() => {
    config.bootData.user = originalUser;
  });

  describe.each([PluginStatus.INSTALL, PluginStatus.UPDATE, PluginStatus.DOWNGRADE])('install (%s)', (installType) => {
    it('asks the server for API discovery again after it succeeds', async () => {
      const action = await runInstall(installType);

      expect(action.type).toBe(install.fulfilled.type);
      await expect(discoveredPreferredVersion()).resolves.toBe('v1');
    });

    it('asks the server for API discovery again when refreshing after it fails', async () => {
      respondTo({ '/api/frontend/settings': () => Promise.reject(new Error('settings failed')) });

      const action = await runInstall(installType);

      expect(action.type).toBe(install.fulfilled.type);
      await expect(discoveredPreferredVersion()).resolves.toBe('v1');
    });

    it('keeps the cached API discovery answer when it fails', async () => {
      installPluginMock.mockRejectedValue(new Error('install failed'));

      const action = await runInstall(installType);

      expect(action.type).toBe(install.rejected.type);
      await expect(discoveredPreferredVersion()).resolves.toBe('v0alpha1');
    });
  });

  describe('uninstall', () => {
    it('asks the server for API discovery again after it succeeds', async () => {
      const action = await runUninstall();

      expect(action.type).toBe(uninstall.fulfilled.type);
      await expect(discoveredPreferredVersion()).resolves.toBe('v1');
    });

    it('asks the server for API discovery again when refreshing after it fails', async () => {
      respondTo({ '/api/frontend/settings': () => Promise.reject(new Error('settings failed')) });

      const action = await runUninstall();

      expect(action.type).toBe(uninstall.fulfilled.type);
      await expect(discoveredPreferredVersion()).resolves.toBe('v1');
    });

    it('keeps the cached API discovery answer when it fails', async () => {
      uninstallPluginMock.mockRejectedValue(new Error('uninstall failed'));

      const action = await runUninstall();

      expect(action.type).toBe(uninstall.rejected.type);
      await expect(discoveredPreferredVersion()).resolves.toBe('v0alpha1');
    });
  });
});
