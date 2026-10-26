import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { createRepository } from 'app/features/provisioning/mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';
import { type DashboardViewItem } from 'app/features/search/types';
import { configureStore } from 'app/store/configureStore';

import { listDashboards, listFolders } from '../api/services';
import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';

import { useRefreshOnRepositorySync } from './useRefreshOnRepositorySync';

jest.mock('../api/services', () => ({
  ...jest.requireActual('../api/services'),
  listFolders: jest.fn(),
  listDashboards: jest.fn(),
}));

setupProvisioningMswServer();

const mockListFolders = jest.mocked(listFolders);
const mockListDashboards = jest.mocked(listDashboards);

function dashboard(uid: string): DashboardViewItem {
  return { kind: 'dashboard', uid, title: uid };
}

const dash1 = dashboard('dash-1');
const dash2 = dashboard('dash-2');
const dash3 = dashboard('dash-3');

function repositoryAt(finished: number, state = 'success') {
  return createRepository({ status: { sync: { state, finished, message: [] } } });
}

function emitSync(finished: number, state = 'success') {
  act(() =>
    getMockLiveSrv().emitWatchEvent('repositories', { type: 'MODIFIED', object: repositoryAt(finished, state) })
  );
}

function setup(folderUID?: string) {
  const repository = repositoryAt(1000);
  server.use(
    http.get(`${BASE}/settings`, () =>
      HttpResponse.json({
        items: [{ name: repository.metadata?.name, title: 'Repo', type: 'github', target: 'folder', workflows: [] }],
      })
    ),
    http.get(`${BASE}/repositories`, () =>
      HttpResponse.json({ items: [repository], metadata: { resourceVersion: '1' } })
    )
  );
  // Remote deleted dash-1; the next fetch of the root no longer returns it.
  mockListFolders.mockResolvedValue([]);
  mockListDashboards.mockResolvedValue([dash2]);

  const store = configureStore({
    browseDashboards: {
      rootItems: fullyLoadedViewItemCollection([dash1, dash2]),
      childrenByParentUID: { 'folder-a': fullyLoadedViewItemCollection([dash3]) },
      openFolders: { 'folder-a': true },
      selectedItems: { $all: false, folder: {}, dashboard: {}, panel: {} },
    },
  });

  const rendered = renderHook(() => useRefreshOnRepositorySync(folderUID), { wrapper: getWrapper({ store }) });

  const browseState = () => store.getState().browseDashboards;
  const rootUids = () => browseState().rootItems?.items.map((item) => item.uid);
  // The first repository status seen only seeds the baseline, so wait for it before emitting.
  const waitForBaseline = () => waitFor(() => expect(browseState().repositorySyncedAt).toBe(1000));

  return { ...rendered, store, browseState, rootUids, waitForBaseline };
}

describe('useRefreshOnRepositorySync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refetches the viewed list and drops other loaded folders when a newer pull wrote content', async () => {
    const { browseState, rootUids, waitForBaseline } = setup();
    await waitForBaseline();
    expect(mockListDashboards).not.toHaveBeenCalled();

    emitSync(2000);

    await waitFor(() => expect(rootUids()).toEqual(['dash-2']));
    expect(browseState().childrenByParentUID['folder-a']).toBeUndefined();
    expect(browseState().openFolders['folder-a']).toBe(false);
    expect(browseState().repositorySyncedAt).toBe(2000);
  });

  it('ignores status updates that wrote nothing', async () => {
    const { browseState, rootUids, waitForBaseline } = setup();
    await waitForBaseline();

    // Same `finished` (e.g. a health check patched the status), then a failed pull.
    emitSync(1000);
    emitSync(2000, 'error');

    await act(() => Promise.resolve());
    expect(mockListDashboards).not.toHaveBeenCalled();
    expect(rootUids()).toEqual(['dash-1', 'dash-2']);
    expect(browseState().childrenByParentUID['folder-a']).toBeDefined();
    expect(browseState().repositorySyncedAt).toBe(1000);
  });

  it('refetches the viewed folder and drops the root when inside a folder', async () => {
    const { browseState, waitForBaseline } = setup('folder-a');
    await waitForBaseline();

    emitSync(2000);

    await waitFor(() => expect(browseState().childrenByParentUID['folder-a']?.items).toEqual([dash2]));
    expect(mockListDashboards).toHaveBeenCalledWith('folder-a', 1, expect.any(Number));
    expect(browseState().rootItems).toBeUndefined();
  });

  it('notices a pull that landed while the list was not mounted', async () => {
    const { rootUids, waitForBaseline, unmount, store } = setup();
    await waitForBaseline();
    unmount();

    // The list query is still cached, so the watch keeps the repository status current.
    emitSync(2000);
    expect(mockListDashboards).not.toHaveBeenCalled();

    renderHook(() => useRefreshOnRepositorySync(undefined), { wrapper: getWrapper({ store }) });

    await waitFor(() => expect(rootUids()).toEqual(['dash-2']));
  });
});
