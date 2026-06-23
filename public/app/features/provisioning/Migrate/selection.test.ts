import { resourceKindInfos } from '../utils/resourceKinds';

import { type FolderRow } from './hooks/useFolderMigrationData';
import { resolveSelection } from './selection';

function folder(uid: string, dashboardUids: string[]): FolderRow {
  const directResources = dashboardUids.map((d) => ({ uid: d, title: d, kind: resourceKindInfos.dashboard }));
  return {
    uid,
    title: uid,
    resourceCount: directResources.length,
    directResources,
  };
}

// A synthetic folder grouping playlists, mirroring how Migrate.tsx surfaces
// folder-less kinds.
function playlistFolder(uid: string, playlistUids: string[]): FolderRow {
  const directResources = playlistUids.map((p) => ({ uid: p, title: p, kind: resourceKindInfos.playlist }));
  return {
    uid,
    title: 'Playlists',
    resourceCount: directResources.length,
    directResources,
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

  it('resolves each resource ref from its own kind', () => {
    const withPlaylists = [...folders, playlistFolder('playlists', ['p1', 'p2'])];

    // Select folder 'a' (2 dashboards) plus one individual playlist.
    const result = resolveSelection(withPlaylists, new Set(['a']), new Set(['p1']));

    expect(result.items).toBe(2);
    expect(result.resources).toHaveLength(3);
    const playlistRefs = result.resources.filter((r) => r.kind === 'Playlist');
    expect(playlistRefs).toEqual([{ name: 'p1', group: 'playlist.grafana.app', kind: 'Playlist' }]);
  });

  it('cascades a selected playlists folder to all its playlists', () => {
    const withPlaylists = [...folders, playlistFolder('playlists', ['p1', 'p2'])];

    const result = resolveSelection(withPlaylists, new Set(['playlists']), new Set());

    expect(result.folders).toBe(1);
    expect(result.items).toBe(1);
    expect(result.resources.map((r) => r.name).sort()).toEqual(['p1', 'p2']);
    expect(result.resources.every((r) => r.kind === 'Playlist')).toBe(true);
  });
});
