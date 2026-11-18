import { type Repository, type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';

import {
  resourceKindInfos,
  getAvailableResourceKinds,
  getKindInfoByGroupKind,
  getKindInfoByItemType,
  getKindInfoByResource,
  getKindInfoByStat,
  getKindInfoByStatGroup,
  getMigratableKinds,
  getReportedGroup,
  getRepositoryRoute,
  coversGroup,
  isFolderScoped,
  listResources,
  isResourceKindAvailable,
} from './resourceKinds';

describe('resourceKinds registry', () => {
  it('exposes an info record per kind with consistent identifiers', () => {
    expect(resourceKindInfos.dashboard).toMatchObject({
      key: 'dashboard',
      group: 'dashboard.grafana.app',
      kind: 'Dashboard',
      resource: 'dashboards',
    });
    expect(resourceKindInfos.folder).toMatchObject({
      key: 'folder',
      group: 'folder.grafana.app',
      kind: 'Folder',
      resource: 'folders',
    });
    expect(resourceKindInfos.playlist).toMatchObject({
      key: 'playlist',
      group: 'playlist.grafana.app',
      kind: 'Playlist',
      resource: 'playlists',
    });
    expect(resourceKindInfos.librarypanel).toMatchObject({
      key: 'librarypanel',
      group: 'dashboard.grafana.app',
      kind: 'LibraryPanel',
      resource: 'librarypanels',
    });
    expect(resourceKindInfos.datasource).toMatchObject({
      key: 'datasource',
      group: 'datasource.grafana.app',
      kind: 'DataSource',
      resource: 'datasources',
      source: { via: 'collection' },
    });
    expect(resourceKindInfos.repository).toMatchObject({
      key: 'repository',
      group: 'provisioning.grafana.app',
      kind: 'Repository',
      resource: 'repositories',
      source: { via: 'none' },
    });
    expect(resourceKindInfos.connection).toMatchObject({
      key: 'connection',
      group: 'provisioning.grafana.app',
      kind: 'Connection',
      resource: 'connections',
      source: { via: 'none' },
    });
  });

  // A bootstrap repository provisions repositories and connections, and their stat badges fall
  // back to a generic icon and a dead link for any kind the registry does not know.
  it('resolves provisioning kinds from a repository stat, including their admin routes', () => {
    const repository = getKindInfoByStat({ group: 'provisioning.grafana.app', resource: 'repositories' });
    const connection = getKindInfoByStat({ group: 'provisioning.grafana.app', resource: 'connections' });

    expect(repository?.icon).toBe('code-branch');
    expect(repository?.routes.item?.('bootstrap')).toBe('/admin/provisioning/bootstrap');
    expect(connection?.icon).toBe('plug');
    expect(connection?.routes.item?.('github-app')).toBe('/admin/provisioning/connections/github-app/edit');
  });

  // They are configuration, not content: the Migrate flow must never offer to move them.
  it('never enumerates provisioning kinds for migration', async () => {
    const deps = { dispatch: jest.fn() };

    expect(await listResources(resourceKindInfos.repository, deps)).toEqual([]);
    expect(await listResources(resourceKindInfos.connection, deps)).toEqual([]);
  });

  it('stamps each entry with its own registry key', () => {
    for (const [key, info] of Object.entries(resourceKindInfos)) {
      expect(info.key).toBe(key);
    }
  });

  it('returns a localized collection label for each kind', () => {
    expect(resourceKindInfos.folder.getLabel()).toBe('Folders');
    expect(resourceKindInfos.dashboard.getLabel()).toBe('Dashboards');
    expect(resourceKindInfos.playlist.getLabel()).toBe('Playlists');
    expect(resourceKindInfos.librarypanel.getLabel()).toBe('Library panels');
    expect(resourceKindInfos.datasource.getLabel()).toBe('Data sources');
    expect(resourceKindInfos.repository.getLabel()).toBe('Repositories');
    expect(resourceKindInfos.connection.getLabel()).toBe('Connections');
  });

  it('treats the search-served kinds, and only those, as folder-scoped', () => {
    // The search index is what reports a parent folder, and the dashboards browse lists what it
    // serves — library panels live in folders on the backend but aren't browsable there.
    expect(
      Object.values(resourceKindInfos)
        .filter(isFolderScoped)
        .map((info) => info.key)
    ).toEqual(['folder', 'dashboard']);
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

describe('routes', () => {
  it('builds in-app routes per kind', () => {
    expect(resourceKindInfos.dashboard.routes.item('abc')).toBe('/d/abc');
    expect(resourceKindInfos.folder.routes.item('xyz')).toBe('/dashboards/f/xyz');
    expect(resourceKindInfos.playlist.routes.item('pl1')).toBe('/playlists/edit/pl1');
    // Library panels have no single-resource page, only their collection.
    expect(resourceKindInfos.librarypanel.routes).toEqual({ list: '/library-panels' });
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
      resourceKindInfos.repository,
      resourceKindInfos.connection,
      resourceKindInfos.datasource,
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

// Data sources are the one kind whose registry `group` is a storage collection rather than a served
// group: each plugin serves its own `{plugin}.datasource.grafana.app`, and that is what the backend
// reports for an individual resource, in availableResources and on a job result row.
describe('collection groups', () => {
  const testdata = 'grafana-testdata-datasource.datasource.grafana.app';

  it('matches a served group inside the collection as well as the collection itself', () => {
    expect(coversGroup(resourceKindInfos.datasource, testdata)).toBe(true);
    expect(coversGroup(resourceKindInfos.datasource, 'datasource.grafana.app')).toBe(true);
  });

  it('does not match a group that merely looks similar', () => {
    expect(coversGroup(resourceKindInfos.datasource, 'notdatasource.grafana.app')).toBe(false);
    expect(coversGroup(resourceKindInfos.datasource, 'datasource.grafana.app.evil')).toBe(false);
  });

  it('leaves a kind served under its own group matching exactly', () => {
    expect(coversGroup(resourceKindInfos.dashboard, 'dashboard.grafana.app')).toBe(true);
    expect(coversGroup(resourceKindInfos.dashboard, 'v2.dashboard.grafana.app')).toBe(false);
  });

  it('resolves a resource reported under a served group back to the kind', () => {
    expect(getKindInfoByGroupKind(testdata, 'DataSource')).toBe(resourceKindInfos.datasource);
    expect(getKindInfoByStat({ group: testdata })).toBe(resourceKindInfos.datasource);
    expect(getKindInfoByStatGroup(testdata)).toBe(resourceKindInfos.datasource);
  });

  it('reports a served group as the collection, and every other group unchanged', () => {
    expect(getReportedGroup(testdata, 'DataSource')).toBe('datasource.grafana.app');
    expect(getReportedGroup('dashboard.grafana.app', 'Dashboard')).toBe('dashboard.grafana.app');
    // An unknown group is no collection member we can name, so it stays as reported.
    expect(getReportedGroup('something.else', 'Thing')).toBe('something.else');
    expect(getReportedGroup(undefined, undefined)).toBeUndefined();
  });

  it('is available and migratable when the backend declares any plugin group', () => {
    const available: SupportedResource[] = [{ group: testdata, kind: 'DataSource' }];

    expect(isResourceKindAvailable(resourceKindInfos.datasource, available)).toBe(true);
    expect(getMigratableKinds(available).map((k) => k.kind)).toEqual(['DataSource']);
  });

  it('is unavailable when the declared plugin group is disabled', () => {
    const available: SupportedResource[] = [{ group: testdata, kind: 'DataSource', disabled: true }];

    expect(isResourceKindAvailable(resourceKindInfos.datasource, available)).toBe(false);
    expect(getMigratableKinds(available)).toEqual([]);
  });
});
