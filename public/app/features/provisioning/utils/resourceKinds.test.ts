import { HttpResponse, http } from 'msw';

import server from '@grafana/test-utils/server';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { addKinds, findKind } from 'app/core/kinds/coreKinds';

import { setupProvisioningMswServer } from '../mocks/server';

import {
  type ResourceKindInfo,
  resourceKindInfos,
  getMigratableKinds,
  isResourceKindAvailable,
  readImmediateParent,
} from './resourceKinds';

describe('resourceKinds registry', () => {
  it('exposes an info record per kind with consistent identifiers', () => {
    expect(resourceKindInfos.dashboard).toMatchObject({
      group: 'dashboard.grafana.app',
      kind: 'Dashboard',
      resource: 'dashboards',
    });
    expect(resourceKindInfos.folder).toMatchObject({
      group: 'folder.grafana.app',
      kind: 'Folder',
      resource: 'folders',
    });
    expect(resourceKindInfos.playlist).toMatchObject({
      group: 'playlist.grafana.app',
      kind: 'Playlist',
      resource: 'playlists',
    });
    expect(resourceKindInfos.librarypanel).toMatchObject({
      group: 'dashboard.grafana.app',
      kind: 'LibraryPanel',
      resource: 'librarypanels',
    });
    expect(resourceKindInfos.datasource).toMatchObject({
      group: 'datasource.grafana.app',
      kind: 'DataSource',
      resource: 'datasources',
      collectionGroup: true,
    });
    expect(resourceKindInfos.repository).toMatchObject({
      group: 'provisioning.grafana.app',
      kind: 'Repository',
      resource: 'repositories',
    });
    expect(resourceKindInfos.connection).toMatchObject({
      group: 'provisioning.grafana.app',
      kind: 'Connection',
      resource: 'connections',
    });
  });

  // They are configuration, not content: the Migrate flow must never offer to move them.
  it('never enumerates provisioning kinds for migration', async () => {
    expect(await resourceKindInfos.repository.list()).toEqual([]);
    expect(await resourceKindInfos.connection.list()).toEqual([]);
  });

  it('names each kind as it reads mid-sentence', () => {
    expect(resourceKindInfos.folder.getLabel({ upperFirst: false })).toBe('folder');
    expect(resourceKindInfos.dashboard.getLabel({ upperFirst: false })).toBe('dashboard');
    expect(resourceKindInfos.playlist.getLabel({ upperFirst: false })).toBe('playlist');
    expect(resourceKindInfos.librarypanel.getLabel({ upperFirst: false })).toBe('library panel');
    expect(resourceKindInfos.datasource.getLabel({ upperFirst: false })).toBe('data source');
  });

  it('every kind exposes a translated plural label and a list function', () => {
    for (const info of Object.values(resourceKindInfos)) {
      expect(info.getPluralLabel()).toBeTruthy();
      expect(typeof info.list).toBe('function');
    }
  });

  it('carries a list-cache invalidation action only for kinds committed through the shared drawer', () => {
    // Playlists commit via SaveProvisionedResourceDrawer and must refresh their list afterwards;
    // dashboards/folders use their own forms, so they don't carry an invalidation action. Widened to
    // ResourceKindInfo so the optional field is visible (the `as const` entries narrow it away).
    const info = (key: keyof typeof resourceKindInfos): ResourceKindInfo => resourceKindInfos[key];
    expect(info('playlist').invalidateListTags?.()).toMatchObject({ type: expect.any(String) });
    expect(info('folder').invalidateListTags).toBeUndefined();
    expect(info('dashboard').invalidateListTags).toBeUndefined();
    expect(info('librarypanel').invalidateListTags).toBeUndefined();
  });
});

describe('getRoute', () => {
  it('builds in-app routes per kind', () => {
    expect(resourceKindInfos.dashboard.getRoute('abc')).toBe('/d/abc');
    expect(resourceKindInfos.folder.getRoute('xyz')).toBe('/dashboards/f/xyz');
    expect(resourceKindInfos.playlist.getRoute('pl1')).toBe('/playlists/edit/pl1');
  });
});

describe('isResourceKindAvailable', () => {
  it('only reports kinds present and not disabled', () => {
    const available: SupportedResource[] = [
      { group: 'dashboard.grafana.app', kind: 'Dashboard' },
      { group: 'folder.grafana.app', kind: 'Folder', disabled: true },
      // Playlists ship declared-but-disabled until the backend can round-trip them.
      { group: 'playlist.grafana.app', kind: 'Playlist', disabled: true },
    ];

    expect(isResourceKindAvailable(resourceKindInfos.dashboard, available)).toBe(true);
    expect(isResourceKindAvailable(resourceKindInfos.folder, available)).toBe(false);
    expect(isResourceKindAvailable(resourceKindInfos.playlist, available)).toBe(false);
  });

  it('reports no kind when none are declared', () => {
    expect(isResourceKindAvailable(resourceKindInfos.dashboard, [])).toBe(false);
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

describe('plugin kinds', () => {
  const group = 'example.ext.grafana.app';

  beforeAll(() => {
    addKinds([
      {
        group: 'example.ext.grafana.app',
        kind: 'Thing',
        resource: 'things',
        folderScoped: false,
        getLabel: ({ upperFirst = true } = {}) => (upperFirst ? 'Plugin thing' : 'plugin thing'),
        getPluralLabel: () => 'Plugin things',
        icon: 'tag-alt',
      },
    ]);
  });

  it('reports a plugin kind as available once the backend enables it', () => {
    const thing = findKind(group, 'Thing');

    expect(thing && isResourceKindAvailable(thing, [{ group, kind: 'Thing' }])).toBe(true);
  });

  it('does not offer a plugin kind for migration', () => {
    const available = [
      { group, kind: 'Thing' },
      { group: 'dashboard.grafana.app', kind: 'Dashboard' },
    ];
    expect(getMigratableKinds(available).map((info) => info.kind)).toEqual(['Dashboard']);
  });
});
