import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { PROVISIONING_API_BASE as BASE, getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { createRepository } from 'app/features/provisioning/mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { type DashboardViewItem } from 'app/features/search/types';
import { configureStore } from 'app/store/configureStore';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';
import { type ViewedFolder } from '../state/utils';

import { useRefreshOnRepositorySync } from './useRefreshOnRepositorySync';

setupProvisioningMswServer();

type Target = 'folder' | 'folderless' | 'instance';

const REPO = createRepository().metadata!.name!;
const OWNED = { kind: ManagerKind.Repo, id: REPO };

// The loaded tree: the repository folder open at the root beside a plain folder and another
// repository's folder.
function item(kind: 'folder' | 'dashboard', uid: string, managerId?: string): DashboardViewItem {
  return { kind, uid, title: uid, managedBy: managerId ? ManagerKind.Repo : undefined, managerId };
}

// What the backend lists after the pull: `repo-dash` became `repo-dash-2`, `deep-dash` became
// `deep-dash-2`, and `top-dash-2` appeared at the top level (a folderless repository's).
function hit(resource: 'folders' | 'dashboards', name: string, folder?: string, managedBy?: DashboardHit['managedBy']) {
  return { resource, name, title: name, folder, managedBy, field: {} };
}
const afterPull: DashboardHit[] = [
  hit('folders', REPO, undefined, OWNED),
  hit('folders', 'plain'),
  hit('folders', 'theirs', undefined, { kind: ManagerKind.Repo, id: 'other-repo' }),
  hit('folders', 'nested', REPO, OWNED),
  hit('dashboards', 'root-dash'),
  hit('dashboards', 'top-dash-2', undefined, OWNED),
  hit('dashboards', 'repo-dash-2', REPO, OWNED),
  hit('dashboards', 'deep-dash-2', 'nested', OWNED),
  hit('dashboards', 'plain-dash', 'plain'),
];

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
  /** Whether the owner of the folder in view is already known when the hook mounts. */
  resolved?: boolean;
}

function setup({ folderUID, viewedRepository, target = 'folder', resolved = true }: SetupOptions = {}) {
  server.use(
    http.get(`${BASE}/settings`, () =>
      HttpResponse.json({ items: [{ name: REPO, title: REPO, type: 'github', target, workflows: [] }] })
    ),
    http.get(`${BASE}/repositories`, () =>
      HttpResponse.json({ items: [repositoryAt(1000, target)], metadata: { resourceVersion: '1' } })
    ),
    getCustomSearchHandler(afterPull)
  );

  // Which collections were listed, by the `folder` the search was scoped to ('general' = root).
  // The searcher's own folder preload carries no `folder` and is not a listing.
  const searchedFolders: string[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    const folder = url.searchParams.get('folder');
    if (url.pathname.endsWith('/search') && folder) {
      searchedFolders.push(folder);
    }
  });

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

  const viewed: ViewedFolder = { folderUID, repository: viewedRepository };
  const render = () =>
    renderHook((props: ViewedFolder | undefined) => useRefreshOnRepositorySync(props), {
      initialProps: resolved ? viewed : undefined,
      wrapper: getWrapper({ store }),
    });
  const rendered = render();

  const browseState = () => store.getState().browseDashboards;
  const children = (uid: string) => uids(browseState().childrenByParentUID[uid]?.items);
  const selected = () => browseState().selectedItems.dashboard;
  const listedFolders = () => Array.from(new Set(searchedFolders));
  // The first repository status seen only seeds the baseline, so wait for it before emitting.
  const waitForBaseline = () => waitFor(() => expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 1000 }));
  const emitSync = (finished: number, state = 'success') =>
    act(() =>
      getMockLiveSrv().emitWatchEvent('repositories', {
        type: 'MODIFIED',
        object: repositoryAt(finished, target, state),
      })
    );

  return { ...rendered, render, viewed, browseState, children, selected, listedFolders, waitForBaseline, emitSync };
}

describe('useRefreshOnRepositorySync', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    server.events.removeAllListeners('request:start');
  });

  it('at the root: refetches the open repository folder in place and drops only what the repository owns', async () => {
    const { browseState, children, selected, listedFolders, waitForBaseline, emitSync } = setup();
    await waitForBaseline();
    expect(listedFolders()).toEqual([]);

    emitSync(2000);

    await waitFor(() => expect(children(REPO)).toEqual(['nested', 'repo-dash-2']));
    expect(browseState().openFolders[REPO]).toBe(true);
    expect(listedFolders()).toEqual([REPO]);

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
    const { browseState, children, listedFolders, waitForBaseline, emitSync } = setup({
      folderUID: 'nested',
      viewedRepository: REPO,
    });
    await waitForBaseline();

    emitSync(2000);

    await waitFor(() => expect(children('nested')).toEqual(['deep-dash-2']));
    expect(listedFolders()).toEqual(['nested']);
    expect(children(REPO)).toBeUndefined();
    expect(children('plain')).toEqual(['plain-dash']);
    expect(uids(browseState().rootItems?.items)).toHaveLength(4);
  });

  it('inside a folder it does not own: nothing on screen changes, its cached folders are dropped', async () => {
    const { browseState, children, selected, listedFolders, waitForBaseline, emitSync } = setup({
      folderUID: 'plain',
    });
    await waitForBaseline();

    emitSync(2000);

    await waitFor(() => expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 2000 }));
    expect(listedFolders()).toEqual([]);
    expect(children('plain')).toEqual(['plain-dash']);
    expect(browseState().openFolders.plain).toBe(true);
    expect(selected()['plain-dash']).toBe(true);
    expect(children(REPO)).toBeUndefined();
    expect(children('nested')).toBeUndefined();
    expect(selected()['repo-dash']).toBe(false);
  });

  it('a folderless repository owns top-level items too, so the root listing is refetched', async () => {
    const { browseState, children, selected, listedFolders, waitForBaseline, emitSync } = setup({
      target: 'folderless',
    });
    await waitForBaseline();

    emitSync(2000);

    await waitFor(() => expect(uids(browseState().rootItems?.items)).toContain('top-dash-2'));
    expect(listedFolders()).toEqual(['general']);
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

    await waitFor(() => expect(uids(browseState().rootItems?.items)).toContain('top-dash-2'));
    expect(children(REPO)).toBeUndefined();
    expect(children('plain')).toBeUndefined();
    expect(children('theirs')).toBeUndefined();
    expect(Object.values(selected()).every((isSelected) => isSelected === false)).toBe(true);
  });

  it('refreshes after a pull that finished with errors, which may still have written resources', async () => {
    const { children, waitForBaseline, emitSync } = setup();
    await waitForBaseline();

    emitSync(2000, 'error');

    await waitFor(() => expect(children(REPO)).toEqual(['nested', 'repo-dash-2']));
  });

  it('ignores a status update whose pull has not advanced', async () => {
    const { browseState, children, selected, listedFolders, waitForBaseline, emitSync } = setup();
    await waitForBaseline();

    // Same `finished`, e.g. a health check patched the status.
    emitSync(1000);

    await act(() => Promise.resolve());
    expect(listedFolders()).toEqual([]);
    expect(children(REPO)).toEqual(['nested', 'repo-dash']);
    expect(children('nested')).toEqual(['deep-dash']);
    expect(selected()['repo-dash']).toBe(true);
    expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 1000 });
  });

  it('keeps the repository marked stale when the refetch fails, so the next visit retries', async () => {
    const { browseState, children, listedFolders, waitForBaseline, emitSync, unmount, render } = setup();
    await waitForBaseline();
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 }), { once: true }));

    emitSync(2000);
    await waitFor(() => expect(listedFolders()).toEqual([REPO]));
    unmount();

    // Had the failed refetch stamped the repository, this mount would find nothing to do.
    render();

    await waitFor(() => expect(children(REPO)).toEqual(['nested', 'repo-dash-2']));
    await waitFor(() => expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 2000 }));
  });

  it('waits for the owner of the folder in view before acting on a pull', async () => {
    const { browseState, children, listedFolders, waitForBaseline, emitSync, rerender, viewed } = setup({
      folderUID: 'nested',
      viewedRepository: REPO,
      resolved: false,
    });
    await waitForBaseline();

    emitSync(2000);

    await act(() => Promise.resolve());
    expect(listedFolders()).toEqual([]);
    expect(children('nested')).toEqual(['deep-dash']);
    expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 1000 });

    // The folder turns out to be the repository's: the pending pull now refreshes it.
    rerender(viewed);

    await waitFor(() => expect(children('nested')).toEqual(['deep-dash-2']));
    await waitFor(() => expect(browseState().repositorySyncedAt).toEqual({ [REPO]: 2000 }));
  });

  it('clears the selection and re-runs the search when a pull lands while searching', async () => {
    const { selected, waitForBaseline, emitSync } = setup();
    const [, stateManager] = renderHook(() => useSearchStateManager()).result.current;
    act(() => stateManager.setState({ query: 'dash' }));
    const doSearch = jest.spyOn(stateManager, 'doSearchWithDebounce').mockImplementation(() => {});
    await waitForBaseline();

    emitSync(2000);

    // Search results are not in the tree, so even unprovisioned results lose their selection.
    await waitFor(() => expect(selected()['plain-dash']).toBe(false));
    expect(doSearch).toHaveBeenCalledTimes(1);

    act(() => stateManager.setState({ query: '' }));
    doSearch.mockRestore();
  });
});
