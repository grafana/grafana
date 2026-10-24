import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { provisioningAPIv0alpha1 } from 'app/api/clients/provisioning/v0alpha1';
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

// The hook remembers each repository's last synced ref for the lifetime of the page (module
// state), so every test gets its own repository name to start from a clean baseline.
let repoCounter = 0;

function setup(folderUID?: string) {
  const repoName = `repo-${++repoCounter}`;
  server.use(
    http.get(`${BASE}/settings`, () =>
      HttpResponse.json({
        items: [{ name: repoName, title: repoName, type: 'github', target: 'folder', workflows: [] }],
      })
    ),
    http.get(`${BASE}/repositories`, () =>
      HttpResponse.json({
        items: [repositoryAt(repoName, 'aaa')],
        metadata: { resourceVersion: '1' },
      })
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
  // Data in the RTK cache is not enough: the hook seeds its baseline in an effect on the next
  // commit, so flush React before emitting an event or the event would be taken as the baseline.
  const waitForWatch = async () => {
    await waitFor(() =>
      expect(
        provisioningAPIv0alpha1.endpoints.listRepository.select({ watch: true })(store.getState()).data
      ).toBeDefined()
    );
    await act(() => Promise.resolve());
  };

  return { ...rendered, store, repoName, browseState, rootUids, waitForWatch };
}

function repositoryAt(name: string, lastRef: string, finished = 1000) {
  return createRepository({
    metadata: { name },
    status: { sync: { state: 'success', finished, lastRef, message: [] } },
  });
}

function emitSync(name: string, lastRef: string, finished: number) {
  act(() =>
    getMockLiveSrv().emitWatchEvent('repositories', { type: 'MODIFIED', object: repositoryAt(name, lastRef, finished) })
  );
}

describe('useRefreshOnRepositorySync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refetches the viewed list and drops other loaded folders when a pull reaches a new commit', async () => {
    const { repoName, browseState, rootUids, waitForWatch } = setup();
    await waitForWatch();
    expect(mockListDashboards).not.toHaveBeenCalled();

    emitSync(repoName, 'bbb', 2000);

    await waitFor(() => expect(rootUids()).toEqual(['dash-2']));
    expect(browseState().childrenByParentUID['folder-a']).toBeUndefined();
    expect(browseState().openFolders['folder-a']).toBe(false);
  });

  it('ignores a sync that finished without reaching a new commit', async () => {
    const { repoName, browseState, rootUids, waitForWatch } = setup();
    await waitForWatch();

    // Interval sync found nothing: `finished` advances, `lastRef` does not.
    emitSync(repoName, 'aaa', 2000);

    await act(() => Promise.resolve());
    expect(mockListDashboards).not.toHaveBeenCalled();
    expect(rootUids()).toEqual(['dash-1', 'dash-2']);
    expect(browseState().childrenByParentUID['folder-a']).toBeDefined();
  });

  it('refetches the viewed folder and drops the root when inside a folder', async () => {
    const { repoName, browseState, waitForWatch } = setup('folder-a');
    await waitForWatch();

    emitSync(repoName, 'bbb', 2000);

    await waitFor(() => expect(browseState().childrenByParentUID['folder-a']?.items).toEqual([dash2]));
    expect(mockListDashboards).toHaveBeenCalledWith('folder-a', 1, expect.any(Number));
    expect(browseState().rootItems).toBeUndefined();
  });

  it('notices a pull that landed while the list was not mounted', async () => {
    const { repoName, rootUids, waitForWatch, unmount, store } = setup();
    await waitForWatch();
    unmount();

    // The list query is still cached, so the watch keeps the repository status current.
    emitSync(repoName, 'bbb', 2000);
    expect(mockListDashboards).not.toHaveBeenCalled();

    renderHook(() => useRefreshOnRepositorySync(undefined), { wrapper: getWrapper({ store }) });

    await waitFor(() => expect(rootUids()).toEqual(['dash-2']));
  });
});
