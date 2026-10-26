import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { ManagerKind } from 'app/features/apiserver/types';
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

type Target = 'folder' | 'folderless' | 'instance';

const REPO = createRepository().metadata!.name!;

function item(kind: 'folder' | 'dashboard', uid: string, managerId?: string): DashboardViewItem {
  return { kind, uid, title: uid, managedBy: managerId ? ManagerKind.Repo : undefined, managerId };
}

const uids = (items: DashboardViewItem[] | undefined) => items?.map((i) => i.uid);

function repositoryAt(finished: number, target: Target, state = 'success') {
  return createRepository({
    spec: { sync: { target, enabled: true } },
    status: { sync: { state, finished, message: [] } },
  });
}

interface SetupOptions {
  folderUID?: string;
  viewedRepository?: string;
  target?: Target;
}

/**
 * The repository folder is open at the root beside a plain folder and another repository's folder.
 * Upstream replaced `repo-dash` with `repo-dash-2`; every refetch of dashboards returns that.
 */
function setup({ folderUID, viewedRepository, target = 'folder' }: SetupOptions = {}) {
  server.use(
    http.get(`${BASE}/settings`, () =>
      HttpResponse.json({ items: [{ name: REPO, title: REPO, type: 'github', target, workflows: [] }] })
    ),
    http.get(`${BASE}/repositories`, () =>
      HttpResponse.json({ items: [repositoryAt(1000, target)], metadata: { resourceVersion: '1' } })
    )
  );
  mockListFolders.mockResolvedValue([]);
  mockListDashboards.mockResolvedValue([item('dashboard', 'repo-dash-2', REPO)]);

  const store = configureStore({
    browseDashboards: {
      rootItems: fullyLoadedViewItemCollection([
        item('folder', REPO, REPO),
        item('folder', 'plain'),
        item('folder', 'theirs', 'other-repo'),
        item('dashboard', 'root-dash'),
      ]),
      childrenByParentUID: {
        [REPO]: fullyLoadedViewItemCollection([item('folder', 'nested', REPO), item('dashboard', 'repo-dash', REPO)]),
        nested: fullyLoadedViewItemCollection([item('dashboard', 'deep-dash', REPO)]),
        plain: fullyLoadedViewItemCollection([item('dashboard', 'plain-dash')]),
        theirs: fullyLoadedViewItemCollection([item('dashboard', 'their-dash', 'other-repo')]),
      },
      openFolders: { [REPO]: true, nested: true, plain: true, theirs: true },
      selectedItems: {
        $all: false,
        folder: {},
        dashboard: { 'repo-dash': true, 'plain-dash': true, 'their-dash': true, 'root-dash': true },
        panel: {},
      },
    },
  });

  const render = () =>
    renderHook(() => useRefreshOnRepositorySync(folderUID, viewedRepository), { wrapper: getWrapper({ store }) });
  const rendered = render();

  const browseState = () => store.getState().browseDashboards;
  const children = (uid: string) => uids(browseState().childrenByParentUID[uid]?.items);
  const selected = () => browseState().selectedItems.dashboard;
  // The first repository status seen only seeds the baseline, so wait for it before emitting.
  const waitForBaseline = () => waitFor(() => expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 1000 }));
  const emitSync = (finished: number, state = 'success') =>
    act(() =>
      getMockLiveSrv().emitWatchEvent('repositories', {
        type: 'MODIFIED',
        object: repositoryAt(finished, target, state),
      })
    );

  return { ...rendered, render, browseState, children, selected, waitForBaseline, emitSync };
}

describe('useRefreshOnRepositorySync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('at the root: refetches the open repository folder in place and drops only what the repository owns', async () => {
    const { browseState, children, selected, waitForBaseline, emitSync } = setup();
    await waitForBaseline();
    expect(mockListDashboards).not.toHaveBeenCalled();

    emitSync(2000);

    await waitFor(() => expect(children(REPO)).toEqual(['repo-dash-2']));
    expect(browseState().openFolders[REPO]).toBe(true);
    expect(mockListDashboards).toHaveBeenCalledTimes(1);
    expect(mockListDashboards).toHaveBeenCalledWith(REPO, 1, expect.any(Number));

    // Nested folders reload when opened next; everything the repository does not own is untouched.
    expect(children('nested')).toBeUndefined();
    expect(browseState().openFolders.nested).toBe(false);
    expect(uids(browseState().rootItems?.items)).toEqual([REPO, 'plain', 'theirs', 'root-dash']);
    expect(children('plain')).toEqual(['plain-dash']);
    expect(children('theirs')).toEqual(['their-dash']);
    expect(browseState().openFolders.plain).toBe(true);

    expect(selected()).toEqual({ 'repo-dash': false, 'plain-dash': true, 'their-dash': true, 'root-dash': true });
    await waitFor(() => expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 2000 }));
  });

  it('inside a folder the repository owns: refetches it in place and drops its other folders', async () => {
    const { browseState, children, waitForBaseline, emitSync } = setup({ folderUID: 'nested', viewedRepository: REPO });
    await waitForBaseline();

    emitSync(2000);

    await waitFor(() => expect(children('nested')).toEqual(['repo-dash-2']));
    expect(mockListDashboards).toHaveBeenCalledTimes(1);
    expect(children(REPO)).toBeUndefined();
    expect(children('plain')).toEqual(['plain-dash']);
    expect(uids(browseState().rootItems?.items)).toHaveLength(4);
  });

  it('inside a folder it does not own: nothing on screen changes, its cached folders are dropped', async () => {
    const { browseState, children, selected, waitForBaseline, emitSync } = setup({ folderUID: 'plain' });
    await waitForBaseline();

    emitSync(2000);

    await waitFor(() => expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 2000 }));
    expect(mockListDashboards).not.toHaveBeenCalled();
    expect(children('plain')).toEqual(['plain-dash']);
    expect(browseState().openFolders.plain).toBe(true);
    expect(selected()['plain-dash']).toBe(true);
    expect(children(REPO)).toBeUndefined();
    expect(children('nested')).toBeUndefined();
    expect(selected()['repo-dash']).toBe(false);
  });

  it('a folderless repository owns top-level items too, so the root listing is refetched', async () => {
    const { browseState, children, selected, waitForBaseline, emitSync } = setup({ target: 'folderless' });
    await waitForBaseline();

    emitSync(2000);

    await waitFor(() => expect(uids(browseState().rootItems?.items)).toEqual(['repo-dash-2']));
    expect(mockListDashboards).toHaveBeenCalledWith(undefined, 1, expect.any(Number));
    expect(children('plain')).toEqual(['plain-dash']);
    expect(children('theirs')).toEqual(['their-dash']);
    expect(children('nested')).toBeUndefined();
    // Only the repository's items leave the selection, even in the refetched root.
    expect(selected()['root-dash']).toBe(true);
    expect(selected()['their-dash']).toBe(true);
  });

  it('an instance repository owns the whole tree', async () => {
    const { browseState, children, selected, waitForBaseline, emitSync } = setup({ target: 'instance' });
    await waitForBaseline();

    emitSync(2000);

    await waitFor(() => expect(uids(browseState().rootItems?.items)).toEqual(['repo-dash-2']));
    expect(children(REPO)).toBeUndefined();
    expect(children('plain')).toBeUndefined();
    expect(children('theirs')).toBeUndefined();
    expect(Object.values(selected()).every((isSelected) => isSelected === false)).toBe(true);
  });

  it('refreshes after a pull that finished with errors, which may still have written resources', async () => {
    const { children, waitForBaseline, emitSync } = setup();
    await waitForBaseline();

    emitSync(2000, 'error');

    await waitFor(() => expect(children(REPO)).toEqual(['repo-dash-2']));
  });

  it('ignores a status update whose pull has not advanced', async () => {
    const { browseState, children, selected, waitForBaseline, emitSync } = setup();
    await waitForBaseline();

    // Same `finished`, e.g. a health check patched the status.
    emitSync(1000);

    await act(() => Promise.resolve());
    expect(mockListDashboards).not.toHaveBeenCalled();
    expect(children(REPO)).toEqual(['nested', 'repo-dash']);
    expect(children('nested')).toEqual(['deep-dash']);
    expect(selected()['repo-dash']).toBe(true);
    expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 1000 });
  });

  it('keeps the repository marked stale when the refetch fails, so the next visit retries', async () => {
    const { browseState, children, waitForBaseline, emitSync, unmount, render } = setup();
    await waitForBaseline();
    mockListFolders.mockRejectedValueOnce(new Error('network down'));

    emitSync(2000);

    await waitFor(() => expect(mockListFolders).toHaveBeenCalledTimes(1));
    await act(() => Promise.resolve());
    expect(children(REPO)).toEqual(['nested', 'repo-dash']);
    expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 1000 });

    unmount();
    render();

    await waitFor(() => expect(children(REPO)).toEqual(['repo-dash-2']));
    await waitFor(() => expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 2000 }));
  });
});
