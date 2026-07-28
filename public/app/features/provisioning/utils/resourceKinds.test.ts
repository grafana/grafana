import { type Repository, type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getIconForKind } from 'app/features/search/service/utils';

import {
  resourceKindInfos,
  getAvailableResourceKinds,
  getKindInfoByGroupKind,
  getKindInfoByItemType,
  getKindInfoByResource,
  getKindInfoByStat,
  getKindInfoByStatGroup,
  getMigratableKinds,
  getRepositoryRoute,
  isResourceKindAvailable,
  readImmediateParent,
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
    expect(resourceKindInfos.librarypanel).toMatchObject({
      group: 'dashboard.grafana.app',
      kind: 'LibraryPanel',
      resource: 'librarypanels',
      itemType: 'LibraryPanel',
    });
  });

  it('sources icons from the search package', () => {
    expect(resourceKindInfos.dashboard.icon).toBe(getIconForKind('dashboard'));
    expect(resourceKindInfos.folder.icon).toBe(getIconForKind('folder'));
  });
  it('gives each entry a `key` equal to its registry key', () => {
    // The type only requires `key` to be some ResourceKindKey; this guards against an entry pointing
    // at the wrong key (e.g. the playlist entry carrying `key: 'dashboard'`), which would silently
    // mislabel commit messages and telemetry.
    for (const [key, info] of Object.entries(resourceKindInfos)) {
      expect(info.key).toBe(key);
    }
  });

  it('returns a localized singular label for each kind', () => {
    expect(resourceKindInfos.folder.getLabel()).toBe('folder');
    expect(resourceKindInfos.dashboard.getLabel()).toBe('dashboard');
    expect(resourceKindInfos.playlist.getLabel()).toBe('playlist');
    expect(resourceKindInfos.librarypanel.getLabel()).toBe('library panel');
  });

  it('every kind exposes a translated plural label and a list function', () => {
    for (const info of Object.values(resourceKindInfos)) {
      expect(info.pluralLabel()).toBeTruthy();
      expect(typeof info.list).toBe('function');
    }
  });

  it('carries a list-cache invalidation action only for kinds committed through the shared drawer', () => {
    // Playlists commit via SaveProvisionedResourceDrawer and must refresh their list afterwards;
    // dashboards/folders use their own forms, so they don't carry an invalidation action. Looked up
    // via getKindInfoByResource so the widened ResourceKindInfo type exposes the optional field (the
    // `as const` registry entries narrow it away on kinds that omit it).
    expect(getKindInfoByResource('playlists')?.invalidateListTags?.()).toMatchObject({ type: expect.any(String) });
    expect(getKindInfoByResource('folders')?.invalidateListTags).toBeUndefined();
    expect(getKindInfoByResource('dashboards')?.invalidateListTags).toBeUndefined();
    expect(getKindInfoByResource('librarypanels')?.invalidateListTags).toBeUndefined();
  });
});

describe('getKindInfoByResource', () => {
  it('resolves by plural resource name', () => {
    expect(getKindInfoByResource('dashboards')).toBe(resourceKindInfos.dashboard);
    expect(getKindInfoByResource('folders')).toBe(resourceKindInfos.folder);
    expect(getKindInfoByResource('playlists')).toBe(resourceKindInfos.playlist);
    expect(getKindInfoByResource('librarypanels')).toBe(resourceKindInfos.librarypanel);
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

describe('getKindInfoByGroupKind', () => {
  it('resolves a job summary row by group and kind', () => {
    expect(getKindInfoByGroupKind('dashboard.grafana.app', 'Dashboard')).toBe(resourceKindInfos.dashboard);
    expect(getKindInfoByGroupKind('folder.grafana.app', 'Folder')).toBe(resourceKindInfos.folder);
  });

  it('disambiguates kinds that share an API group by the kind', () => {
    // Dashboards and library panels both live in dashboard.grafana.app.
    expect(getKindInfoByGroupKind('dashboard.grafana.app', 'LibraryPanel')).toBe(resourceKindInfos.librarypanel);
    expect(getKindInfoByGroupKind('dashboard.grafana.app', 'Dashboard')).toBe(resourceKindInfos.dashboard);
  });

  it('resolves on whichever identifier is present', () => {
    expect(getKindInfoByGroupKind(undefined, 'Playlist')).toBe(resourceKindInfos.playlist);
    expect(getKindInfoByGroupKind('playlist.grafana.app', undefined)).toBe(resourceKindInfos.playlist);
  });

  it('returns undefined when nothing matches or both identifiers are missing', () => {
    expect(getKindInfoByGroupKind('alert.grafana.app', 'AlertRule')).toBeUndefined();
    expect(getKindInfoByGroupKind(undefined, undefined)).toBeUndefined();
  });
});

describe('getKindInfoByStat', () => {
  it('resolves by the plural resource name', () => {
    expect(getKindInfoByStat({ group: 'dashboard.grafana.app', resource: 'dashboards' })).toBe(
      resourceKindInfos.dashboard
    );
    expect(getKindInfoByStat({ group: 'playlist.grafana.app', resource: 'playlists' })).toBe(
      resourceKindInfos.playlist
    );
  });

  it('prefers the resource over the group when they point at different kinds', () => {
    // The resource uniquely identifies the kind, so it wins over a group that
    // would otherwise resolve to a different kind.
    expect(getKindInfoByStat({ group: 'dashboard.grafana.app', resource: 'folders' })).toBe(resourceKindInfos.folder);
    // Dashboards and library panels share dashboard.grafana.app; the resource tells them apart.
    expect(getKindInfoByStat({ group: 'dashboard.grafana.app', resource: 'librarypanels' })).toBe(
      resourceKindInfos.librarypanel
    );
  });

  it('falls back to a group-only match when the resource is missing or unknown', () => {
    expect(getKindInfoByStat({ group: 'folder.grafana.app' })).toBe(resourceKindInfos.folder);
    expect(getKindInfoByStat({ group: 'folders' })).toBe(resourceKindInfos.folder);
  });

  it('returns undefined when neither resource nor group is known', () => {
    expect(getKindInfoByStat({ group: 'alert.grafana.app', resource: 'rules' })).toBeUndefined();
    expect(getKindInfoByStat({})).toBeUndefined();
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

  it('routes library panels to their own collection page regardless of target', () => {
    // Library panels live in folders but aren't browsable in the dashboards folder
    // view, so they always resolve to /library-panels.
    expect(getRepositoryRoute(resourceKindInfos.librarypanel, makeRepo('folder'))).toBe('/library-panels');
    expect(getRepositoryRoute(resourceKindInfos.librarypanel, makeRepo('instance'))).toBe('/library-panels');
  });

  it('falls back to the collection page when the repository name or spec is missing', () => {
    // No spec → not a folder target → collection page.
    expect(getRepositoryRoute(resourceKindInfos.dashboard, {})).toBe('/dashboards');
    // Folder target but no metadata → no folder to scope to → collection page
    // (rather than a broken `/dashboards/f/undefined`).
    const noMetadata: Repository = {
      spec: { title: 'r', type: 'github', sync: { target: 'folder', enabled: true }, workflows: [] },
    };
    expect(getRepositoryRoute(resourceKindInfos.folder, noMetadata)).toBe('/dashboards');
  });
});

describe('getAvailableResourceKinds', () => {
  it('falls back to all known kinds when availableResources is unset', () => {
    expect(getAvailableResourceKinds(undefined)).toEqual([
      resourceKindInfos.folder,
      resourceKindInfos.dashboard,
      resourceKindInfos.playlist,
      resourceKindInfos.librarypanel,
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

describe('readImmediateParent', () => {
  it('treats a missing location as root (no parent)', () => {
    // DashboardQueryResult.location is optional — a folderless dashboard yields
    // undefined, which must not throw.
    expect(readImmediateParent(undefined)).toBeUndefined();
  });

  it('treats empty and the literal "general" UID as root', () => {
    expect(readImmediateParent('')).toBeUndefined();
    expect(readImmediateParent('   ')).toBeUndefined();
    expect(readImmediateParent('general')).toBeUndefined();
  });

  it('returns the trimmed parent folder UID otherwise', () => {
    expect(readImmediateParent(' team-a ')).toBe('team-a');
  });
});

describe('getMigratableKinds', () => {
  it('returns only the always-available base (dashboards) when availableResources is unset', () => {
    // Folders are excluded (the container others nest under); playlists and
    // library panels are gated and not in the static base.
    expect(getMigratableKinds(undefined).map((k) => k.kind)).toEqual(['Dashboard']);
  });

  it('adds a kind once the backend reports it available', () => {
    const kinds = getMigratableKinds([
      { group: 'dashboard.grafana.app', kind: 'Dashboard' },
      { group: 'playlist.grafana.app', kind: 'Playlist' },
    ]);
    expect(kinds.map((k) => k.kind).sort()).toEqual(['Dashboard', 'Playlist']);
  });

  it('never includes folders, even when available', () => {
    const kinds = getMigratableKinds([{ group: 'folder.grafana.app', kind: 'Folder' }]);
    expect(kinds.some((k) => k.kind === 'Folder')).toBe(false);
  });

  it('honors the backend set once loaded — even dashboards are dropped when disabled or omitted', () => {
    // Once availableResources is populated it is authoritative for every kind,
    // including the otherwise always-available base, so an overridden
    // [provisioning] resources config that disables or omits dashboards excludes
    // them from the migrate UI.
    expect(
      getMigratableKinds([{ group: 'dashboard.grafana.app', kind: 'Dashboard', disabled: true }]).map((k) => k.kind)
    ).toEqual([]);
    expect(getMigratableKinds([{ group: 'playlist.grafana.app', kind: 'Playlist' }]).map((k) => k.kind)).toEqual([
      'Playlist',
    ]);
  });
});
