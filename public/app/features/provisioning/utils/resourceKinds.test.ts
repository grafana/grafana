import { type Repository, type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getIconForKind } from 'app/features/search/service/utils';

import {
  resourceKindInfos,
  getAvailableResourceKinds,
  getKindInfoByItemType,
  getKindInfoByResource,
  getKindInfoByStatGroup,
  getRepositoryRoute,
  isResourceKindAvailable,
} from './resourceKinds';

describe('resourceKinds registry', () => {
  it('exposes an info record per kind with consistent identifiers', () => {
    expect(resourceKindInfos.dashboard).toMatchObject({
      group: 'dashboard.grafana.app',
      kind: 'Dashboard',
      resource: 'dashboards',
      itemType: 'Dashboard',
    });
    expect(resourceKindInfos.folder).toMatchObject({
      group: 'folder.grafana.app',
      kind: 'Folder',
      resource: 'folders',
      itemType: 'Folder',
    });
    expect(resourceKindInfos.playlist).toMatchObject({
      group: 'playlist.grafana.app',
      kind: 'Playlist',
      resource: 'playlists',
      itemType: 'Playlist',
    });
  });

  it('sources icons from the search package', () => {
    expect(resourceKindInfos.dashboard.icon).toBe(getIconForKind('dashboard'));
    expect(resourceKindInfos.folder.icon).toBe(getIconForKind('folder'));
  });
});

describe('getKindInfoByResource', () => {
  it('resolves by plural resource name', () => {
    expect(getKindInfoByResource('dashboards')).toBe(resourceKindInfos.dashboard);
    expect(getKindInfoByResource('folders')).toBe(resourceKindInfos.folder);
    expect(getKindInfoByResource('playlists')).toBe(resourceKindInfos.playlist);
  });

  it('returns undefined for unknown or missing resources', () => {
    expect(getKindInfoByResource('unknown-type')).toBeUndefined();
    expect(getKindInfoByResource(undefined)).toBeUndefined();
  });
});

describe('getKindInfoByItemType', () => {
  it('resolves by item type', () => {
    expect(getKindInfoByItemType('Dashboard')).toBe(resourceKindInfos.dashboard);
    expect(getKindInfoByItemType('Folder')).toBe(resourceKindInfos.folder);
  });

  it('returns undefined for the non-resource File type', () => {
    expect(getKindInfoByItemType('File')).toBeUndefined();
  });
});

describe('getKindInfoByStatGroup', () => {
  it('matches the full API group', () => {
    expect(getKindInfoByStatGroup('dashboard.grafana.app')).toBe(resourceKindInfos.dashboard);
    expect(getKindInfoByStatGroup('folder.grafana.app')).toBe(resourceKindInfos.folder);
  });

  it('matches the legacy short plural form', () => {
    expect(getKindInfoByStatGroup('folders')).toBe(resourceKindInfos.folder);
  });

  it('returns undefined for unknown groups', () => {
    expect(getKindInfoByStatGroup('alert.grafana.app')).toBeUndefined();
  });
});

describe('getRoute', () => {
  it('builds in-app routes per kind', () => {
    expect(resourceKindInfos.dashboard.getRoute('abc')).toBe('/d/abc');
    expect(resourceKindInfos.folder.getRoute('xyz')).toBe('/dashboards/f/xyz');
    expect(resourceKindInfos.playlist.getRoute('pl1')).toBe('/playlists/edit/pl1');
  });
});

describe('getRepositoryRoute', () => {
  const makeRepo = (target: 'folder' | 'folderless' | 'instance'): Repository => ({
    metadata: { name: 'my-repo' },
    spec: { title: 'My Repo', type: 'github', sync: { target, enabled: true }, workflows: [] },
  });

  it('routes folder-scoped kinds to the repository folder for folder targets', () => {
    expect(getRepositoryRoute(resourceKindInfos.folder, makeRepo('folder'))).toBe('/dashboards/f/my-repo');
    expect(getRepositoryRoute(resourceKindInfos.dashboard, makeRepo('folder'))).toBe('/dashboards/f/my-repo');
  });

  it('routes folder-scoped kinds to their collection page for non-folder targets', () => {
    expect(getRepositoryRoute(resourceKindInfos.dashboard, makeRepo('instance'))).toBe('/dashboards');
    expect(getRepositoryRoute(resourceKindInfos.folder, makeRepo('folderless'))).toBe('/dashboards');
  });

  it('routes non-folder-scoped kinds to their collection page regardless of target', () => {
    expect(getRepositoryRoute(resourceKindInfos.playlist, makeRepo('folder'))).toBe('/playlists');
    expect(getRepositoryRoute(resourceKindInfos.playlist, makeRepo('instance'))).toBe('/playlists');
  });

  it('tolerates a repository missing spec or metadata', () => {
    // No spec → not a folder target → collection page.
    expect(getRepositoryRoute(resourceKindInfos.dashboard, {})).toBe('/dashboards');
    // Folder target but no metadata → folder route with an empty name segment.
    const noMetadata: Repository = {
      spec: { title: 'r', type: 'github', sync: { target: 'folder', enabled: true }, workflows: [] },
    };
    expect(getRepositoryRoute(resourceKindInfos.folder, noMetadata)).toBe('/dashboards/f/undefined');
  });
});

describe('countLabel', () => {
  it('produces singular and plural labels per kind', () => {
    expect(resourceKindInfos.dashboard.countLabel(1)).toBe('1 dashboard');
    expect(resourceKindInfos.dashboard.countLabel(3)).toBe('3 dashboards');
    expect(resourceKindInfos.folder.countLabel(1)).toBe('1 folder');
    expect(resourceKindInfos.folder.countLabel(3)).toBe('3 folders');
    expect(resourceKindInfos.playlist.countLabel(1)).toBe('1 playlist');
    expect(resourceKindInfos.playlist.countLabel(3)).toBe('3 playlists');
  });
});

describe('getAvailableResourceKinds', () => {
  it('falls back to all known kinds when availableResources is unset', () => {
    expect(getAvailableResourceKinds(undefined)).toEqual([
      resourceKindInfos.folder,
      resourceKindInfos.dashboard,
      resourceKindInfos.playlist,
    ]);
  });

  it('only returns kinds present and not disabled', () => {
    const available: SupportedResource[] = [
      { group: 'dashboard.grafana.app', kind: 'Dashboard' },
      { group: 'folder.grafana.app', kind: 'Folder', disabled: true },
      // Playlists ship declared-but-disabled until the backend can round-trip them.
      { group: 'playlist.grafana.app', kind: 'Playlist', disabled: true },
    ];

    const result = getAvailableResourceKinds(available);

    expect(result).toEqual([resourceKindInfos.dashboard]);
    expect(isResourceKindAvailable(resourceKindInfos.dashboard, available)).toBe(true);
    expect(isResourceKindAvailable(resourceKindInfos.folder, available)).toBe(false);
    expect(isResourceKindAvailable(resourceKindInfos.playlist, available)).toBe(false);
  });

  it('returns no kinds when none are declared', () => {
    expect(getAvailableResourceKinds([])).toEqual([]);
  });

  it('matches on group/kind, not object identity', () => {
    const available: SupportedResource[] = [{ group: 'dashboard.grafana.app', kind: 'Dashboard' }];
    // A separate object with the same group/kind as the registry entry.
    const equivalent = { ...resourceKindInfos.dashboard };

    expect(isResourceKindAvailable(equivalent, available)).toBe(true);
  });
});
