import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { setupProvisioningMswServer } from '../../mocks/server';
import { getMigratableKinds, resourceKindInfos } from '../../utils/resourceKinds';

import { useMigrationData } from './useMigrationData';

setupProvisioningMswServer();

const PLAYLISTS_ROUTE = '/apis/playlist.grafana.app/v1/namespaces/:namespace/playlists';

// Kinds are derived from the registry. With no availableResources only the
// always-on base (dashboards) is migratable; declaring the playlist kind brings
// it in too.
const dashboardKinds = getMigratableKinds(undefined);
const playlistAvailable: SupportedResource[] = [
  { group: 'dashboard.grafana.app', kind: 'Dashboard' },
  { group: 'playlist.grafana.app', kind: 'Playlist' },
];
const dashboardAndPlaylistKinds = getMigratableKinds(playlistAvailable);

// Render with the app providers; the searcher and the playlist apiserver list
// are both driven through MSW.
let wrapper: ReturnType<typeof getWrapper>;
beforeEach(() => {
  wrapper = getWrapper({});
});

function folder(name: string, parent = ''): DashboardHit {
  return { resource: 'folders', name, title: name, folder: parent, field: {} };
}

function dashboard(name: string, parent = '', managedBy?: ManagerKind): DashboardHit {
  return {
    resource: 'dashboards',
    name,
    title: name,
    folder: parent,
    field: {},
    ...(managedBy ? { managedBy: { kind: managedBy } } : {}),
  };
}

function mockSearch(hits: DashboardHit[]) {
  server.use(getCustomSearchHandler(hits));
}

interface PlaylistItem {
  metadata: { name: string; annotations?: Record<string, string> };
  spec: { title: string; interval: string; items: [] };
}
function playlist(name: string, title: string, managedBy?: ManagerKind): PlaylistItem {
  return {
    metadata: { name, ...(managedBy ? { annotations: { [AnnoKeyManagerKind]: managedBy } } : {}) },
    spec: { title, interval: '5m', items: [] },
  };
}
function mockPlaylists(items: PlaylistItem[]) {
  server.use(http.get(PLAYLISTS_ROUTE, () => HttpResponse.json({ items, metadata: {} })));
}

describe('useMigrationData (folder-scoped kinds)', () => {
  it('nests unmanaged dashboards under the folder directly containing them (not recursively)', async () => {
    mockSearch([folder('parent'), folder('child', 'parent'), dashboard('d1', 'parent'), dashboard('d2', 'child')]);

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const parent = result.current.data.find((f) => f.uid === 'parent');
    expect(parent?.directResources.map((d) => d.uid)).toEqual(['d1']);
    expect(result.current.data.find((f) => f.uid === 'child')?.directResources.map((d) => d.uid)).toEqual(['d2']);
  });

  it('records the ancestor path for nested folders and leaves root/general rows pathless', async () => {
    mockSearch([
      folder('grandparent'),
      folder('parent', 'grandparent'),
      folder('child', 'parent'),
      dashboard('d1', 'child'),
      dashboard('r1', ''),
    ]);

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The deeply-nested folder carries its ancestors, outermost first, excluding itself.
    expect(result.current.data.find((f) => f.uid === 'child')?.path).toEqual(['grandparent', 'parent']);
    // Root resources roll into the pathless General row.
    expect(result.current.data.find((f) => f.uid === 'general')?.path).toEqual([]);
  });

  it('stops the ancestor walk when a parent folder is not in the listed folders', async () => {
    // `orphan` points at a parent (`ghost`) that the search never returned, so
    // the walk can't resolve it. The path ends up empty rather than throwing.
    mockSearch([folder('orphan', 'ghost'), dashboard('d1', 'orphan')]);

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'orphan')?.path).toEqual([]);
  });

  it('falls back to the folder uid and an empty path when the containing folder is not listed', async () => {
    // The dashboard names a parent folder that search never returned as a folder
    // row. The row still renders, keyed by the parent uid it references, with the
    // uid used as the title (no folder title to resolve) and no ancestor path.
    mockSearch([dashboard('d1', 'unlisted')]);

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    const [row] = result.current.data;
    // Unresolved folder: the title falls back to the uid and the path is empty.
    expect(row.title).toBe(row.uid);
    expect(row.path).toEqual([]);
    expect(row.directResources.map((d) => d.uid)).toEqual(['d1']);
  });

  it('does not loop forever on a cyclic parent reference', async () => {
    // A malformed hierarchy where `a` and `b` are each other's parent. The seen
    // guard stops the walk after one hop instead of spinning indefinitely.
    mockSearch([folder('a', 'b'), folder('b', 'a'), dashboard('d1', 'a')]);

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'a')?.path).toEqual(['b']);
  });

  it('rolls root-level dashboards into a synthetic General row and excludes managed ones', async () => {
    mockSearch([
      folder('a'),
      dashboard('r1', 'general'),
      dashboard('r2', ''),
      dashboard('a1', 'a'),
      dashboard('m1', 'a', ManagerKind.Repo),
    ]);

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'general')?.resourceCount).toBe(2);
    // Folder `a` keeps only the unmanaged a1 (m1 is dropped).
    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((d) => d.uid)).toEqual(['a1']);
  });

  it('sets isError when the search request fails', async () => {
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('reloads the data when refetch is called', async () => {
    mockSearch([folder('a'), dashboard('d1', 'a')]);

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);

    mockSearch([folder('a'), dashboard('d1', 'a'), folder('b'), dashboard('d2', 'b')]);
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toHaveLength(2));
  });

  it('pages through results that span more than one page', async () => {
    // 201 dashboards forces a second page (PAGE_SIZE is 200), exercising the
    // totalRows-driven batched fetch.
    mockSearch([folder('f'), ...Array.from({ length: 201 }, (_, index) => dashboard(`d${index}`, 'f'))]);

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'f')?.resourceCount).toBe(201);
  });

  it('fails loudly instead of truncating when results exceed the page cap', async () => {
    // Report far more rows than the searcher can page through; it should error
    // rather than return a silently truncated list.
    server.use(
      http.get(searchRoute, () =>
        HttpResponse.json({ totalHits: 999999, hits: [{ resource: 'folders', name: 'f', title: 'f', folder: '' }] })
      )
    );

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
  });
});

describe('useMigrationData (non-folder kinds)', () => {
  it('groups unmanaged playlists under a synthetic Playlists folder', async () => {
    mockSearch([]);
    mockPlaylists([
      playlist('p1', 'Morning rotation'),
      playlist('p2', 'Ops wall'),
      playlist('p3', 'Git managed', ManagerKind.Repo),
    ]);

    const { result } = renderHook(() => useMigrationData(dashboardAndPlaylistKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // No dashboards in the search response, so only the synthetic playlists row.
    expect(result.current.data).toHaveLength(1);
    const row = result.current.data[0];
    expect(row.title).toBe('Playlists');
    // p3 is already managed, so only p1 and p2 are migration candidates.
    expect(row.directResources.map((r) => r.uid)).toEqual(['p1', 'p2']);
    expect(row.directResources.every((r) => r.kind.kind === 'Playlist')).toBe(true);
  });

  it('skips the folder listing entirely when no kind is folder-scoped', async () => {
    // Playlists are the only kind here and aren't folder-scoped, so the hook
    // never lists folders. A search failure must not matter — nothing depends
    // on it — and the synthetic playlist row still renders.
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    mockPlaylists([playlist('p1', 'Morning rotation')]);

    const { result } = renderHook(() => useMigrationData([resourceKindInfos.playlist]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.data.map((f) => f.title)).toEqual(['Playlists']);
    expect(result.current.data[0].directResources.map((r) => r.uid)).toEqual(['p1']);
  });

  it('falls back to the name when a playlist has no title, and drops entries without a name', async () => {
    mockSearch([]);
    // p1 has no title (falls back to its name); the bare entry has no
    // metadata/spec at all (dropped).
    server.use(
      http.get(PLAYLISTS_ROUTE, () =>
        HttpResponse.json({ items: [{ metadata: { name: 'p1' }, spec: { title: '' } }, {}], metadata: {} })
      )
    );

    const { result } = renderHook(() => useMigrationData(dashboardAndPlaylistKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const row = result.current.data[0];
    expect(row.directResources.map((r) => ({ uid: r.uid, title: r.title }))).toEqual([{ uid: 'p1', title: 'p1' }]);
  });

  it('lists library panels through their apiserver, tolerating an empty response', async () => {
    // Library panels are gated out of the migrate flow by default, but the kind
    // still knows how to list itself through its apiserver collection. A response
    // without an items array yields an empty list rather than throwing.
    server.use(
      http.get('/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/librarypanels', () =>
        HttpResponse.json({ metadata: {} })
      )
    );

    // Library panels list via getBackendSrv and ignore dispatch.
    const result = await resourceKindInfos.librarypanel.list();
    expect(result).toEqual([]);
  });

  it('enumerates folder-scoped and non-folder kinds together', async () => {
    mockSearch([folder('a'), dashboard('d1', 'a')]);
    mockPlaylists([playlist('p1', 'Morning rotation')]);

    const { result } = renderHook(() => useMigrationData(dashboardAndPlaylistKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((d) => d.uid)).toEqual(['d1']);
    expect(result.current.data.find((f) => f.title === 'Playlists')?.directResources.map((r) => r.uid)).toEqual(['p1']);
  });

  it('still renders the kinds that loaded when another kind fails to list', async () => {
    // Dashboards load fine; the playlist apiserver list errors. The table must
    // still show the dashboard rather than blanking the whole list.
    mockSearch([folder('a'), dashboard('d1', 'a')]);
    server.use(http.get(PLAYLISTS_ROUTE, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useMigrationData(dashboardAndPlaylistKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((d) => d.uid)).toEqual(['d1']);
    // The kind that failed is reported so callers can flag an incomplete list.
    expect(result.current.failedKinds.map((k) => k.kind)).toEqual(['Playlist']);
  });

  it('reports an error when every kind fails even if the folder labels load', async () => {
    // Folders (labels only) load, but the dashboard search fails. A folder-only
    // success must not be treated as a successful enumeration.
    server.use(
      http.get(searchRoute, ({ request }) => {
        const types = new URL(request.url).searchParams.getAll('type');
        if (types.includes('dashboard')) {
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ totalHits: 1, hits: [{ resource: 'folders', name: 'a', title: 'a', folder: '' }] });
      })
    );

    const { result } = renderHook(() => useMigrationData(dashboardKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('reports an error only when nothing could be enumerated at all', async () => {
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    server.use(http.get(PLAYLISTS_ROUTE, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useMigrationData(dashboardAndPlaylistKinds), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });
});
