import { type FolderRow } from './hooks/useFolderMigrationData';
import { resolveSelection } from './selection';

function folder(uid: string, dashboardUids: string[]): FolderRow {
  const dashboards = dashboardUids.map((d) => ({ uid: d, title: d }));
  return {
    uid,
    title: uid,
    dashboardCount: dashboards.length,
    directDashboards: dashboards,
  };
}

describe('resolveSelection', () => {
  const folders = [folder('a', ['a1', 'a2']), folder('b', ['b1'])];

  it('returns an empty selection when nothing is picked', () => {
    const result = resolveSelection(folders, new Set(), new Set());
    expect(result.items).toBe(0);
    expect(result.resources).toEqual([]);
  });

  it('cascades a selected folder to the dashboards directly inside it', () => {
    const result = resolveSelection(folders, new Set(['a']), new Set());

    expect(result.folders).toBe(1);
    expect(result.items).toBe(1);
    expect(result.resources).toHaveLength(2);
    expect(result.resources.map((r) => r.name).sort()).toEqual(['a1', 'a2']);
    expect(result.resources[0]).toMatchObject({ group: 'dashboard.grafana.app', kind: 'Dashboard' });
  });

  it('counts a lone dashboard on top of a selected folder', () => {
    const result = resolveSelection(folders, new Set(['a']), new Set(['b1']));

    // 1 folder + 1 independent dashboard = 2 items; 3 dashboards in the payload.
    expect(result.items).toBe(2);
    expect(result.resources).toHaveLength(3);
    expect(result.resources.map((r) => r.name).sort()).toEqual(['a1', 'a2', 'b1']);
  });

  it('does not double-count a dashboard that is also inside a selected folder', () => {
    const result = resolveSelection(folders, new Set(['a']), new Set(['a1']));

    // The folder already covers a1, so the explicit tick adds no extra item
    // and no duplicate resource.
    expect(result.items).toBe(1);
    expect(result.resources).toHaveLength(2);
    expect(result.resources.map((r) => r.name).sort()).toEqual(['a1', 'a2']);
  });

  it('adds selected playlists as their own resource refs', () => {
    const result = resolveSelection(folders, new Set(['a']), new Set(), new Set(['p1', 'p2']));

    // 1 folder + 2 playlists = 3 items; payload carries the folder's 2
    // dashboards plus the 2 playlists.
    expect(result.items).toBe(3);
    expect(result.resources).toHaveLength(4);
    const playlistRefs = result.resources.filter((r) => r.kind === 'Playlist');
    expect(playlistRefs.map((r) => r.name).sort()).toEqual(['p1', 'p2']);
    expect(playlistRefs[0]).toMatchObject({ group: 'playlist.grafana.app', kind: 'Playlist' });
  });

  it('resolves a playlist-only selection', () => {
    const result = resolveSelection(folders, new Set(), new Set(), new Set(['p1']));

    expect(result.folders).toBe(0);
    expect(result.items).toBe(1);
    expect(result.resources).toEqual([{ name: 'p1', group: 'playlist.grafana.app', kind: 'Playlist' }]);
  });
});
