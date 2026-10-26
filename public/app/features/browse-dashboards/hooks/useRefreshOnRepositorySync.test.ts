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
import { fetchNextChildrenPage } from '../state/actions';
import { useLoadNextChildrenPage } from '../state/hooks';
import { type ViewedFolder } from '../state/utils';

import { useRefreshOnRepositorySync } from './useRefreshOnRepositorySync';

setupProvisioningMswServer();

type Target = 'folder' | 'folderless' | 'instance';

const REPO = createRepository().metadata!.name!;
const OWNED = { kind: ManagerKind.Repo, id: REPO };

// Loaded tree: the repository folder open at the root beside a plain folder and another repository's.
const item = (kind: 'folder' | 'dashboard', uid: string, managerId?: string): DashboardViewItem => ({
  kind,
  uid,
  title: uid,
  managedBy: managerId ? ManagerKind.Repo : undefined,
  managerId,
});

// Listing after the pull: `repo-dash` became `repo-dash-2`, `deep-dash` became `deep-dash-2`, and
// `top-dash-2` appeared at the top level (a folderless repository's).
const hit = (
  resource: 'folders' | 'dashboards',
  name: string,
  folder?: string,
  managedBy?: DashboardHit['managedBy']
): DashboardHit => ({ resource, name, title: name, folder, managedBy, field: {} });
const afterPull = [
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

const repositoryAt = (finished: number, target: Target, state = 'success') =>
  createRepository({ spec: { sync: { target, enabled: true } }, status: { sync: { state, finished, message: [] } } });

interface SetupOptions {
  viewed?: ViewedFolder;
  target?: Target;
  /** Mount before the owner of the folder in view is known. */
  unresolved?: boolean;
  /** Open folders left without a collection, as while their first page is loading. */
  loading?: string[];
}

function setup({
  viewed = { folderUID: undefined, repository: undefined },
  target = 'folder',
  unresolved,
  loading = [],
}: SetupOptions = {}) {
  server.use(
    http.get(`${BASE}/settings`, () =>
      HttpResponse.json({ items: [{ name: REPO, title: REPO, type: 'github', target, workflows: [] }] })
    ),
    http.get(`${BASE}/repositories`, () =>
      HttpResponse.json({ items: [repositoryAt(1000, target)], metadata: { resourceVersion: '1' } })
    ),
    getCustomSearchHandler(afterPull)
  );
  // Collections listed, by the `folder` the search was scoped to ('general' = root). The searcher's
  // folder preload carries no `folder`.
  const listed: string[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    const folder = url.searchParams.get('folder');
    if (url.pathname.endsWith('/search') && folder && !listed.includes(folder)) {
      listed.push(folder);
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
        [REPO]: loading.includes(REPO)
          ? undefined
          : fullyLoadedViewItemCollection([item('folder', 'nested', REPO), item('dashboard', 'repo-dash', REPO)]),
        nested: loading.includes('nested')
          ? undefined
          : fullyLoadedViewItemCollection([item('dashboard', 'deep-dash', REPO)]),
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
    renderHook((props: ViewedFolder | undefined) => useRefreshOnRepositorySync(props), {
      initialProps: unresolved ? undefined : viewed,
      wrapper: getWrapper({ store }),
    });
  const state = () => store.getState().browseDashboards;
  const children = (uid: string) => uids(state().childrenByParentUID[uid]?.items);
  const selected = () => state().selectedItems.dashboard;
  const syncedAt = () => state().repositorySyncedAt;
  const emitSync = (finished: number, syncState = 'success') =>
    act(() =>
      getMockLiveSrv().emitWatchEvent('repositories', {
        type: 'MODIFIED',
        object: repositoryAt(finished, target, syncState),
      })
    );

  return { ...render(), render, store, viewed, state, children, selected, syncedAt, listed, emitSync };
}

describe('useRefreshOnRepositorySync', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    server.events.removeAllListeners('request:start');
  });

  // The first repository status seen only seeds the baseline, so tests wait for it before emitting.
  const seeded = (syncedAt: () => Record<string, number> | undefined) =>
    waitFor(() => expect(syncedAt()).toEqual({ [REPO]: 1000 }));

  it('at the root: refetches the open repository folder in place and drops only what the repository owns', async () => {
    const { state, children, selected, syncedAt, listed, emitSync } = setup();
    await seeded(syncedAt);
    expect(listed).toEqual([]);

    emitSync(2000);

    await waitFor(() => expect(children(REPO)).toEqual(['nested', 'repo-dash-2']));
    expect(listed).toEqual([REPO]);
    expect(state().openFolders[REPO]).toBe(true);
    // Nested folders reload when opened next; everything the repository does not own is untouched.
    expect(children('nested')).toBeUndefined();
    expect(state().openFolders.nested).toBe(false);
    expect(uids(state().rootItems?.items)).toEqual([REPO, 'plain', 'theirs', 'root-dash']);
    expect(children('plain')).toEqual(['plain-dash']);
    expect(children('theirs')).toEqual(['their-dash']);
    expect(selected()).toEqual({ 'repo-dash': false, 'plain-dash': true, 'their-dash': true, 'root-dash': true });
    await waitFor(() => expect(syncedAt()).toEqual({ [REPO]: 2000 }));
  });

  it('inside a folder it does not own: nothing on screen changes, its cached folders are dropped', async () => {
    const { children, selected, syncedAt, listed, emitSync } = setup({
      viewed: { folderUID: 'plain', repository: undefined },
    });
    await seeded(syncedAt);

    emitSync(2000);

    await waitFor(() => expect(syncedAt()).toEqual({ [REPO]: 2000 }));
    expect(listed).toEqual([]);
    expect(children('plain')).toEqual(['plain-dash']);
    expect(selected()['plain-dash']).toBe(true);
    expect(children(REPO)).toBeUndefined();
    expect(selected()['repo-dash']).toBe(false);
  });

  it('a folderless repository owns top-level items too, so the root is refetched; unowned items stay selected', async () => {
    const { state, children, selected, syncedAt, listed, emitSync } = setup({ target: 'folderless' });
    await seeded(syncedAt);

    emitSync(2000);

    await waitFor(() => expect(uids(state().rootItems?.items)).toContain('top-dash-2'));
    expect(listed).toEqual(['general']);
    expect(children('plain')).toEqual(['plain-dash']);
    expect(children('nested')).toBeUndefined();
    expect(selected()['root-dash']).toBe(true);
    expect(selected()['their-dash']).toBe(true);
  });

  it('an instance repository owns the whole tree', async () => {
    const { state, children, selected, syncedAt, emitSync } = setup({ target: 'instance' });
    await seeded(syncedAt);

    emitSync(2000);

    await waitFor(() => expect(uids(state().rootItems?.items)).toContain('top-dash-2'));
    expect(children(REPO)).toBeUndefined();
    expect(children('plain')).toBeUndefined();
    expect(Object.values(selected()).every((isSelected) => isSelected === false)).toBe(true);
  });

  it('acts on `finished` alone: an unchanged value is ignored, a later failed pull still refreshes', async () => {
    const { children, syncedAt, listed, emitSync } = setup();
    await seeded(syncedAt);

    // Same `finished`, e.g. a health check patched the status.
    emitSync(1000);
    await act(() => Promise.resolve());
    expect(listed).toEqual([]);
    expect(children(REPO)).toEqual(['nested', 'repo-dash']);

    emitSync(2000, 'error');
    await waitFor(() => expect(children(REPO)).toEqual(['nested', 'repo-dash-2']));
  });

  it('keeps the repository marked stale when the refetch fails, so the next visit retries', async () => {
    const { children, syncedAt, listed, emitSync, unmount, render } = setup();
    await seeded(syncedAt);
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 }), { once: true }));

    emitSync(2000);
    await waitFor(() => expect(listed).toEqual([REPO]));
    unmount();

    // Had the failed refetch stamped the repository, this mount would find nothing to do.
    render();

    await waitFor(() => expect(children(REPO)).toEqual(['nested', 'repo-dash-2']));
    await waitFor(() => expect(syncedAt()).toEqual({ [REPO]: 2000 }));
  });

  it('waits for the owner of the folder in view before acting on a pull', async () => {
    const { children, syncedAt, listed, emitSync, rerender, viewed } = setup({
      viewed: { folderUID: 'nested', repository: REPO },
      unresolved: true,
    });
    await seeded(syncedAt);

    emitSync(2000);
    await act(() => Promise.resolve());
    expect(listed).toEqual([]);
    expect(syncedAt()).toEqual({ [REPO]: 1000 });

    // The folder turns out to be the repository's: the pending pull refreshes it in place.
    rerender(viewed);

    await waitFor(() => expect(children('nested')).toEqual(['deep-dash-2']));
    expect(children(REPO)).toBeUndefined();
    await waitFor(() => expect(syncedAt()).toEqual({ [REPO]: 2000 }));
  });

  it('clears the selection and re-runs the search when a pull lands while searching', async () => {
    const { selected, syncedAt, emitSync } = setup();
    const [, stateManager] = renderHook(() => useSearchStateManager()).result.current;
    act(() => stateManager.setState({ query: 'dash' }));
    const doSearch = jest.spyOn(stateManager, 'doSearchWithDebounce').mockImplementation(() => {});
    await seeded(syncedAt);

    emitSync(2000);

    // Search results are not in the tree, so even unprovisioned results lose their selection.
    await waitFor(() => expect(selected()['plain-dash']).toBe(false));
    expect(doSearch).toHaveBeenCalledTimes(1);

    act(() => stateManager.setState({ query: '' }));
    doSearch.mockRestore();
  });

  /** Holds the first dashboards page of `folder` until released; it still lists the pre-pull item. */
  function holdFirstPage(folder: string, stale: DashboardHit) {
    let release!: () => void;
    let held = false;
    server.use(
      http.get(searchRoute, async ({ request }) => {
        const url = new URL(request.url);
        if (held || url.searchParams.get('folder') !== folder || url.searchParams.get('type') !== 'dashboard') {
          return;
        }
        held = true;
        await new Promise<void>((resolve) => (release = resolve));
        return HttpResponse.json({ totalHits: 1, hits: [stale] });
      })
    );
    return { release: () => release(), isHeld: () => held };
  }

  it('makes a first page still in flight for the viewed folder obsolete, so the fresh one wins', async () => {
    const { store, children, syncedAt, emitSync } = setup({
      viewed: { folderUID: 'nested', repository: REPO },
      loading: ['nested'],
    });
    await seeded(syncedAt);
    const oldPage = holdFirstPage('nested', hit('dashboards', 'deep-dash', 'nested', OWNED));
    const loader = renderHook(() => useLoadNextChildrenPage(), { wrapper: getWrapper({ store }) });
    loader.result.current('nested');
    await waitFor(() => expect(oldPage.isHeld()).toBe(true));

    emitSync(2000);
    await waitFor(() => expect(syncedAt()).toEqual({ [REPO]: 2000 }));
    oldPage.release();

    await waitFor(() => expect(children('nested')).toEqual(['deep-dash-2']));
  });

  it('loads the open repository folder at the root fresh when its first page was in flight', async () => {
    // Expanding dispatches the first page directly, outside the tree loader.
    const { store, children, state, syncedAt, emitSync } = setup({ loading: [REPO] });
    await seeded(syncedAt);
    const oldPage = holdFirstPage(REPO, hit('dashboards', 'repo-dash', REPO, OWNED));
    store.dispatch(fetchNextChildrenPage({ parentUID: REPO, pageSize: 50 }));
    await waitFor(() => expect(oldPage.isHeld()).toBe(true));

    emitSync(2000);
    await waitFor(() => expect(children(REPO)).toEqual(['nested', 'repo-dash-2']));
    oldPage.release();

    await waitFor(() => expect(syncedAt()).toEqual({ [REPO]: 2000 }));
    expect(children(REPO)).toEqual(['nested', 'repo-dash-2']);
    expect(state().openFolders[REPO]).toBe(true);
  });
});
