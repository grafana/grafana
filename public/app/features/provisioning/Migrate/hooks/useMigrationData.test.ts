import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { setupProvisioningMswServer } from '../../mocks/server';

import { migrationSources } from './migrationSources';
import { useMigrationData } from './useMigrationData';

setupProvisioningMswServer();

const PLAYLISTS_ROUTE = '/apis/playlist.grafana.app/v1/namespaces/:namespace/playlists';
const [dashboardSource, playlistSource] = migrationSources;

// A fresh store per test so RTK Query's playlist cache doesn't leak between
// tests; the searcher is driven through MSW directly.
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

    const { result } = renderHook(() => useMigrationData([dashboardSource]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const parent = result.current.data.find((f) => f.uid === 'parent');
    expect(parent?.directResources.map((d) => d.uid)).toEqual(['d1']);
    expect(result.current.data.find((f) => f.uid === 'child')?.directResources.map((d) => d.uid)).toEqual(['d2']);
  });

  it('rolls root-level dashboards into a synthetic General row and excludes managed ones', async () => {
    mockSearch([
      folder('a'),
      dashboard('r1', 'general'),
      dashboard('r2', ''),
      dashboard('a1', 'a'),
      dashboard('m1', 'a', ManagerKind.Repo),
    ]);

    const { result } = renderHook(() => useMigrationData([dashboardSource]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'general')?.resourceCount).toBe(2);
    // Folder `a` keeps only the unmanaged a1 (m1 is dropped).
    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((d) => d.uid)).toEqual(['a1']);
  });

  it('sets isError when the search request fails', async () => {
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useMigrationData([dashboardSource]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('reloads the data when refetch is called', async () => {
    mockSearch([folder('a'), dashboard('d1', 'a')]);

    const { result } = renderHook(() => useMigrationData([dashboardSource]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);

    mockSearch([folder('a'), dashboard('d1', 'a'), folder('b'), dashboard('d2', 'b')]);
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toHaveLength(2));
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

    const { result } = renderHook(() => useMigrationData([playlistSource]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    const row = result.current.data[0];
    expect(row.title).toBe('Playlists');
    // p3 is already managed, so only p1 and p2 are migration candidates.
    expect(row.directResources.map((r) => r.uid)).toEqual(['p1', 'p2']);
    expect(row.directResources.every((r) => r.kind.kind === 'Playlist')).toBe(true);
  });

  it('enumerates folder-scoped and non-folder kinds together', async () => {
    mockSearch([folder('a'), dashboard('d1', 'a')]);
    mockPlaylists([playlist('p1', 'Morning rotation')]);

    const { result } = renderHook(() => useMigrationData([dashboardSource, playlistSource]), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((d) => d.uid)).toEqual(['d1']);
    expect(result.current.data.find((f) => f.title === 'Playlists')?.directResources.map((r) => r.uid)).toEqual(['p1']);
  });
});
