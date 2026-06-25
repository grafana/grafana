import { HttpResponse, http } from 'msw';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import server from '@grafana/test-utils/server';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { setupProvisioningMswServer } from '../../mocks/server';

import { usePlaylistMigrationData } from './usePlaylistMigrationData';

setupProvisioningMswServer();

const PLAYLISTS_ROUTE = '/apis/playlist.grafana.app/v1/namespaces/:namespace/playlists';

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

// A fresh store per test so RTK Query's cache (keyed on the same `{}` arg)
// doesn't leak one test's playlists into the next.
let wrapper: ReturnType<typeof getWrapper>;
beforeEach(() => {
  wrapper = getWrapper({});
});

describe('usePlaylistMigrationData', () => {
  it('returns the unmanaged playlists with their title and uid', async () => {
    mockPlaylists([playlist('p1', 'Morning rotation'), playlist('p2', 'Ops wall')]);

    const { result } = renderHook(() => usePlaylistMigrationData(true), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([
      { uid: 'p1', title: 'Morning rotation' },
      { uid: 'p2', title: 'Ops wall' },
    ]);
  });

  it('drops playlists already owned by a manager', async () => {
    mockPlaylists([
      playlist('p1', 'Unmanaged'),
      playlist('p2', 'Git managed', ManagerKind.Repo),
      playlist('p3', 'Terraform managed', ManagerKind.Terraform),
    ]);

    const { result } = renderHook(() => usePlaylistMigrationData(true), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.map((p) => p.uid)).toEqual(['p1']);
  });

  it('falls back to the uid when a playlist has no title', async () => {
    mockPlaylists([playlist('p1', '')]);

    const { result } = renderHook(() => usePlaylistMigrationData(true), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([{ uid: 'p1', title: 'p1' }]);
  });

  it('does no work and returns an empty list when disabled', async () => {
    let requested = false;
    server.use(
      http.get(PLAYLISTS_ROUTE, () => {
        requested = true;
        return HttpResponse.json({ items: [], metadata: {} });
      })
    );

    const { result } = renderHook(() => usePlaylistMigrationData(false), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(requested).toBe(false);
  });
});
