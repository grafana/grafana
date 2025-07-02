import { setBackendSrv } from '@grafana/runtime';

import { API_ROOT, GCOM_API_ROOT } from '../constants';
import * as permissions from '../permissions';
import { CatalogPlugin, LocalPlugin, RemotePlugin, Version, ReducerState, RequestStatus } from '../types';

import catalogPluginMock from './catalogPlugin.mock';
import localPluginMock from './localPlugin.mock';
import remotePluginMock from './remotePlugin.mock';

// Returns a sample mock for a CatalogPlugin plugin with the possibility to extend it
export const getCatalogPluginMock = (overrides?: Partial<CatalogPlugin>) => ({ ...catalogPluginMock, ...overrides });

// Returns a sample mock for a local (installed) plugin with the possibility to extend it
export const getLocalPluginMock = (overrides?: Partial<LocalPlugin>) => ({ ...localPluginMock, ...overrides });

// Returns a sample mock for a remote plugin with the possibility to extend it
export const getRemotePluginMock = (overrides?: Partial<RemotePlugin>) => ({ ...remotePluginMock, ...overrides });

// Returns a mock for the Redux store state of plugins
export const getPluginsStateMock = (plugins: CatalogPlugin[] = []): ReducerState => ({
  // @ts-ignore - We don't need the rest of the properties here as we are using the "new" reducer (public/app/features/plugins/admin/state/reducer.ts)
  items: {
    ids: plugins.map(({ id }) => id),
    entities: plugins.reduce((prev, current) => ({ ...prev, [current.id]: current }), {}),
  },
  requests: {
    'plugins/fetchAll': {
      status: RequestStatus.Fulfilled,
    },
    'plugins/fetchDetails': {
      status: RequestStatus.Fulfilled,
    },
  },
  // Backward compatibility
  plugins: [],
  errors: [],
  searchQuery: '',
  hasFetched: false,
  dashboards: [],
  isLoadingPluginDashboards: false,
  panels: {},
});

// Mocks a plugin by considering what needs to be mocked from GCOM and what needs to be mocked locally (local Grafana API)
export const mockPluginApis = ({
  remote: remoteOverride,
  local: localOverride,
  versions,
}: {
  remote?: Partial<RemotePlugin>;
  local?: Partial<LocalPlugin>;
  versions?: Version[];
}) => {
  const remote = getRemotePluginMock(remoteOverride);
  const local = getLocalPluginMock(localOverride);
  const original = jest.requireActual('@grafana/runtime');
  const originalBackendSrv = original.getBackendSrv();

  setBackendSrv({
    ...originalBackendSrv,
    get: (path: string) => {
      // Mock GCOM plugins (remote) if necessary
      if (remote && path === `${GCOM_API_ROOT}/plugins`) {
        return Promise.resolve({ items: [remote] });
      }

      // Mock GCOM single plugin page (remote) if necessary
      if (remote && path === `${GCOM_API_ROOT}/plugins/${remote.slug}`) {
        return Promise.resolve(remote);
      }

      // Mock versions
      if (versions && path === `${GCOM_API_ROOT}/plugins/${remote.slug}/versions`) {
        return Promise.resolve({ items: versions });
      }

      // Mock local plugin settings (installed) if necessary
      if (local && path === `${API_ROOT}/${local.id}/settings`) {
        return Promise.resolve(local);
      }

      // Mock local plugin listing (of necessary)
      if (local && path === API_ROOT) {
        return Promise.resolve([local]);
      }

      // Fall back to the original .get() in other cases
      return originalBackendSrv.get(path);
    },
  });
};

type UserAccessTestContext = {
  isAdmin: boolean;
  isOrgAdmin: boolean;
  isDataSourceEditor: boolean;
};

jest.mock('../permissions');

export function mockUserPermissions(options: UserAccessTestContext): void {
  const mock = jest.mocked(permissions);
  mock.isDataSourceEditor.mockReturnValue(options.isDataSourceEditor);
  mock.isOrgAdmin.mockReturnValue(options.isOrgAdmin);
  mock.isGrafanaAdmin.mockReturnValue(options.isAdmin);
}
