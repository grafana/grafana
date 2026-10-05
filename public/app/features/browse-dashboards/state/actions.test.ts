import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import { searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { STARRED_FOLDERS_UID } from 'app/features/search/constants';
import { configureStore } from 'app/store/configureStore';

import { fetchNextChildrenPage } from './actions';

jest.mock('app/core/services/context_srv', () => {
  const contextSrvModule = jest.requireActual('app/core/services/context_srv');
  return {
    ...contextSrvModule,
    contextSrv: {
      ...contextSrvModule.contextSrv,
      hasPermission: jest.fn(),
    },
  };
});

setBackendSrv(backendSrv);
setupMockServer();

const folderHits: DashboardHit[] = [
  { resource: 'folders', name: 'editable', title: 'Editable', folder: 'parent-uid', field: {} },
  { resource: 'folders', name: 'read-only', title: 'Read only', folder: 'parent-uid', field: {} },
];
const editableUIDs = ['editable'];

// The shared mock search handler ignores `permission`, so this one filters edit-permission searches itself
function mockSearchWithEditPermissions() {
  const editPermissionRequests: URL[] = [];

  server.use(
    http.get(searchRoute, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('permission') !== 'edit') {
        return HttpResponse.json({ totalHits: folderHits.length, hits: folderHits });
      }

      editPermissionRequests.push(url);
      const names = url.searchParams.getAll('name');
      const hits = folderHits.filter((hit) => names.includes(hit.name) && editableUIDs.includes(hit.name));
      return HttpResponse.json({ totalHits: hits.length, hits });
    })
  );

  return editPermissionRequests;
}

function createStore() {
  return configureStore();
}

async function loadFolderChildren(store: ReturnType<typeof createStore>, parentUID: string) {
  await store.dispatch(fetchNextChildrenPage({ parentUID, excludeKinds: ['dashboard'], pageSize: 50 }));
}

describe('browse-dashboards folder edit access', () => {
  beforeEach(() => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(true);
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('marks each loaded folder as editable or read-only', async () => {
    setTestFlags({ 'grafana.browseDashboardsFolderEditAccess': true, foldersAppPlatformAPI: true });
    const editPermissionRequests = mockSearchWithEditPermissions();
    const store = createStore();

    await loadFolderChildren(store, 'parent-uid');

    // The edit access lookup is not awaited by the children fetch, so it settles afterwards
    await waitFor(() =>
      expect(store.getState().browseDashboards.folderEditAccess).toEqual({ editable: true, 'read-only': false })
    );
    expect(editPermissionRequests).toHaveLength(1);
    expect(editPermissionRequests[0].searchParams.getAll('name')).toEqual(['editable', 'read-only']);
  });

  it('keys folders under a virtual root by their prefixed tree UID', async () => {
    setTestFlags({ 'grafana.browseDashboardsFolderEditAccess': true, foldersAppPlatformAPI: true });
    const editPermissionRequests = mockSearchWithEditPermissions();
    const store = createStore();

    await loadFolderChildren(store, `${STARRED_FOLDERS_UID}/parent-uid`);

    await waitFor(() =>
      expect(store.getState().browseDashboards.folderEditAccess).toEqual({
        [`${STARRED_FOLDERS_UID}/editable`]: true,
        [`${STARRED_FOLDERS_UID}/read-only`]: false,
      })
    );
    expect(editPermissionRequests[0].searchParams.getAll('name')).toEqual(['editable', 'read-only']);
  });

  it.each<{ name: string; flags: Parameters<typeof setTestFlags>[0] }>([
    { name: 'the feature flag is off', flags: { foldersAppPlatformAPI: true } },
    {
      name: 'the app platform folders API is off',
      flags: { 'grafana.browseDashboardsFolderEditAccess': true, foldersAppPlatformAPI: false },
    },
  ])('does not request edit access when $name', async ({ flags }) => {
    setTestFlags(flags);
    const editPermissionRequests = mockSearchWithEditPermissions();
    const store = createStore();

    await loadFolderChildren(store, 'parent-uid');

    expect(editPermissionRequests).toHaveLength(0);
    expect(store.getState().browseDashboards.folderEditAccess).toEqual({});
  });
});
