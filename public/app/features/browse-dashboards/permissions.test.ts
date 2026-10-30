import { config, setBackendSrv } from '@grafana/runtime';
import { getKindDiscoveryHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_STARRED_KIND_PAGE, MOCK_STARRED_KIND_SERVED } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { loadStarredKinds, resetStarredKinds } from 'app/features/stars/kinds';
import { configureStore } from 'app/store/configureStore';

import { canEditItemType } from './permissions';
import { type BrowseDashboardsPermissions } from './types';

setBackendSrv(backendSrv);
setupMockServer();

describe('canEditItemType', () => {
  const dashboardsOnly: BrowseDashboardsPermissions = { canEditFolders: false, canEditDashboards: true };
  const foldersOnly: BrowseDashboardsPermissions = { canEditFolders: true, canEditDashboards: false };

  afterEach(() => resetStarredKinds());

  it.each([
    { kind: 'folder', permissions: foldersOnly, expected: true },
    { kind: 'folder', permissions: dashboardsOnly, expected: false },
    { kind: 'dashboard', permissions: dashboardsOnly, expected: true },
    { kind: 'dashboard', permissions: foldersOnly, expected: false },
    // The search table's select-all header asks about `*`, which follows dashboard permissions
    { kind: '*', permissions: dashboardsOnly, expected: true },
    { kind: '*', permissions: foldersOnly, expected: false },
  ])('answers $expected for $kind with edit rights on $permissions', ({ kind, permissions, expected }) => {
    expect(canEditItemType(kind, permissions)).toBe(expected);
  });

  it("never lets an app kind's objects be edited, whatever the permissions", async () => {
    config.bootData.navTree = [MOCK_STARRED_KIND_PAGE];
    configureStore();
    server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED));
    await loadStarredKinds();
    const everything = { ...dashboardsOnly, canEditFolders: true, canDeleteDashboards: true };

    expect(canEditItemType('things.ext.grafana.app/Thing', everything)).toBe(false);
  });
});
