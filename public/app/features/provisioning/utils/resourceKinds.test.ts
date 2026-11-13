import { HttpResponse, http } from 'msw';

import server from '@grafana/test-utils/server';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getIconForKind } from 'app/features/search/service/icons';

import { setupProvisioningMswServer } from '../mocks/server';

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
  coversGroup,
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
    expect(resourceKindInfos.datasource).toMatchObject({
      group: 'datasource.grafana.app',
      kind: 'DataSource',
      resource: 'datasources',
      itemType: 'DataSource',
      collectionGroup: true,
    });
    expect(resourceKindInfos.repository).toMatchObject({
      group: 'provisioning.grafana.app',
      kind: 'Repository',
      resource: 'repositories',
      itemType: 'Repository',
    });
    expect(resourceKindInfos.connection).toMatchObject({
      group: 'provisioning.grafana.app',
      kind: 'Connection',
      resource: 'connections',
      itemType: 'Connection',
    });
  });

  // A bootstrap repository provisions repositories and connections, and their stat badges fall
  // back to a generic icon and a dead link for any kind the registry does not know.
  it('resolves provisioning kinds from a repository stat, including their admin routes', () => {
    const repository = getKindInfoByStat({ group: 'provisioning.grafana.app', resource: 'repositories' });
    const connection = getKindInfoByStat({ group: 'provisioning.grafana.app', resource: 'connections' });

    expect(repository?.icon).toBe('code-branch');
    expect(repository?.getRoute?.('bootstrap')).toBe('/admin/provisioning/bootstrap');
    expect(connection?.icon).toBe('plug');
    expect(connection?.getRoute?.('github-app')).toBe('/admin/provisioning/connections/github-app/edit');
  });

  // They are configuration, not content: the Migrate flow must never offer to move them.
  it('never enumerates provisioning kinds for migration', async () => {
    expect(await resourceKindInfos.repository.list()).toEqual([]);
    expect(await resourceKindInfos.connection.list()).toEqual([]);
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
    expect(resourceKindInfos.datasource.getLabel()).toBe('data source');
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

describe('listing a collection kind', () => {
  setupProvisioningMswServer();

  function discovery(groups: Array<{ name: string; version: string; resource: string }>) {
    return http.get('/apis', () =>
      HttpResponse.json({
        items: groups.map(({ name, version, resource }) => ({
          metadata: { name },
          versions: [{ version, resources: [{ resource, responseKind: {} }] }],
        })),
      })
    );
  }

  function datasources(group: string, version: string, names: string[], spec: Record<string, unknown> = {}) {
    return http.get(`/apis/${group}/${version}/namespaces/:namespace/datasources`, () =>
      HttpResponse.json({ items: names.map((name) => ({ metadata: { name }, spec: { title: name, ...spec } })) })
    );
  }

  const bothServed = () =>
    server.use(
      discovery([
        { name: 'prometheus.datasource.grafana.app', version: 'v0alpha1', resource: 'datasources' },
        { name: 'loki.datasource.grafana.app', version: 'v1beta1', resource: 'datasources' },
        // Neither a member of the collection nor, for the second, a server for the kind.
        { name: 'dashboard.grafana.app', version: 'v1beta1', resource: 'dashboards' },
        { name: 'other.datasource.grafana.app', version: 'v0alpha1', resource: 'connections' },
      ]),
      datasources('prometheus.datasource.grafana.app', 'v0alpha1', ['prom']),
      datasources('loki.datasource.grafana.app', 'v1beta1', ['logs'])
    );

  const prom = { uid: 'prom', title: 'prom', managed: false, group: 'prometheus.datasource.grafana.app' };
  const logs = { uid: 'logs', title: 'logs', managed: false, group: 'loki.datasource.grafana.app' };

  function list(availableResources?: SupportedResource[]) {
    return resourceKindInfos.datasource.list({ dispatch: jest.fn(), availableResources });
  }

  it('lists the members of every group discovery serves the kind under', async () => {
    bothServed();

    // Each member carries the group that serves it, which is how a job addresses it.
    await expect(list([{ group: 'datasource.grafana.app', kind: 'DataSource' }])).resolves.toEqual([prom, logs]);
  });

  it('lists every served member before settings declare which ones provisioning acts on', async () => {
    bothServed();

    await expect(list(undefined)).resolves.toEqual([prom, logs]);
  });

  // A member declared on its own reaches the frontend verbatim: only a wildcard pattern is reported
  // as its collection. Enumerating a member provisioning does not act on would offer it for
  // migration and have the job reject the reference.
  it('lists only the member declared, when the collection itself is not', async () => {
    bothServed();

    await expect(list([{ group: 'prometheus.datasource.grafana.app', kind: 'DataSource' }])).resolves.toEqual([prom]);
  });

  it('leaves out a member disabled on its own inside an enabled collection', async () => {
    bothServed();

    await expect(
      list([
        { group: 'datasource.grafana.app', kind: 'DataSource' },
        { group: 'loki.datasource.grafana.app', kind: 'DataSource', disabled: true },
      ])
    ).resolves.toEqual([prom]);
  });

  it('lists a member enabled on its own inside a disabled collection', async () => {
    bothServed();

    await expect(
      list([
        { group: 'datasource.grafana.app', kind: 'DataSource', disabled: true },
        { group: 'loki.datasource.grafana.app', kind: 'DataSource' },
      ])
    ).resolves.toEqual([logs]);
  });

  // Classic file provisioning marks a data source read-only and leaves no manager annotation, so
  // the annotation check alone would offer a resource no write can take over.
  it('reports a read-only member as managed, keeping it out of migration', async () => {
    server.use(
      discovery([{ name: 'prometheus.datasource.grafana.app', version: 'v0alpha1', resource: 'datasources' }]),
      datasources('prometheus.datasource.grafana.app', 'v0alpha1', ['file-prom'], { readOnly: true })
    );

    await expect(list([{ group: 'datasource.grafana.app', kind: 'DataSource' }])).resolves.toEqual([
      { uid: 'file-prom', title: 'file-prom', managed: true, group: 'prometheus.datasource.grafana.app' },
    ]);
  });

  it('lists nothing when no group serves the collection', async () => {
    server.use(discovery([{ name: 'dashboard.grafana.app', version: 'v1beta1', resource: 'dashboards' }]));

    await expect(list([{ group: 'datasource.grafana.app', kind: 'DataSource' }])).resolves.toEqual([]);
  });
});
