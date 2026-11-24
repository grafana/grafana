import { type KindInfo } from '@grafana/runtime/unstable';

import {
  addKinds,
  CORE_KINDS,
  coversGroup,
  findKind,
  findKindByResource,
  getAppKinds,
  getKindGroup,
  getKinds,
} from './coreKinds';

describe('getRoute', () => {
  it('encodes the object name', () => {
    expect(CORE_KINDS.folder.getRoute('a b/c')).toBe('/dashboards/f/a%20b%2Fc');
  });

  it('leaves the path after the name as written', () => {
    expect(CORE_KINDS.connection.getRoute('a b/c')).toBe('/admin/provisioning/connections/a%20b%2Fc/edit');
  });
});

describe('labels', () => {
  it('start with a capital by default and read mid-sentence on request', () => {
    expect(CORE_KINDS.librarypanel.getLabel()).toBe('Library panel');
    expect(CORE_KINDS.librarypanel.getLabel({ upperFirst: false })).toBe('library panel');
    expect(CORE_KINDS.datasource.getPluralLabel()).toBe('Data sources');
  });
});

// Data sources are the one kind whose `group` is a storage collection rather than a served group:
// each plugin serves its own `{plugin}.datasource.grafana.app`, and that is the group a single
// resource carries.
describe('collection groups', () => {
  const testdata = 'grafana-testdata-datasource.datasource.grafana.app';

  it('matches a served group inside the collection as well as the collection itself', () => {
    expect(coversGroup(CORE_KINDS.datasource, testdata)).toBe(true);
    expect(coversGroup(CORE_KINDS.datasource, 'datasource.grafana.app')).toBe(true);
  });

  it('does not match a group that merely looks similar', () => {
    expect(coversGroup(CORE_KINDS.datasource, 'notdatasource.grafana.app')).toBe(false);
    expect(coversGroup(CORE_KINDS.datasource, 'datasource.grafana.app.evil')).toBe(false);
  });

  it('leaves a kind served under its own group matching exactly', () => {
    expect(coversGroup(CORE_KINDS.dashboard, 'dashboard.grafana.app')).toBe(true);
    expect(coversGroup(CORE_KINDS.dashboard, 'v2.dashboard.grafana.app')).toBe(false);
  });

  it('resolves an object under a served group back to the kind', () => {
    expect(findKind(testdata, 'DataSource')).toBe(CORE_KINDS.datasource);
  });
});

describe('findKind', () => {
  it('tells apart kinds that share a group', () => {
    expect(findKind('dashboard.grafana.app', 'Dashboard')).toBe(CORE_KINDS.dashboard);
    expect(findKind('dashboard.grafana.app', 'Notebook')).toBe(CORE_KINDS.notebook);
    expect(findKind('dashboard.grafana.app', 'LibraryPanel')).toBe(CORE_KINDS.librarypanel);
  });

  it('finds nothing for a kind the group does not serve', () => {
    expect(findKind('dashboard.grafana.app', 'Playlist')).toBeUndefined();
  });
});

describe('findKindByResource', () => {
  it('finds a core kind by its plural resource name', () => {
    expect(findKindByResource('playlists')).toBe(CORE_KINDS.playlist);
  });

  it('narrows by group, including a group served inside a collection', () => {
    expect(findKindByResource('dashboards', 'dashboard.grafana.app')).toBe(CORE_KINDS.dashboard);
    expect(findKindByResource('dashboards', 'folder.grafana.app')).toBeUndefined();
    expect(findKindByResource(CORE_KINDS.datasource.resource, `prometheus.${CORE_KINDS.datasource.group}`)).toBe(
      CORE_KINDS.datasource
    );
  });
});

describe('getKindGroup', () => {
  it('names a collection member by the collection group', () => {
    expect(getKindGroup(`prometheus.${CORE_KINDS.datasource.group}`, CORE_KINDS.datasource.kind)).toBe(
      CORE_KINDS.datasource.group
    );
  });

  it('keeps the group of a kind served under its own group, or of an unknown kind', () => {
    expect(getKindGroup('dashboard.grafana.app', 'Dashboard')).toBe('dashboard.grafana.app');
    expect(getKindGroup('unknown.example.app', 'Thing')).toBe('unknown.example.app');
  });
});

describe('app kinds', () => {
  const group = 'example.ext.grafana.app';

  function appKind(kind: string, label: string): KindInfo {
    return {
      group,
      kind,
      resource: `${kind.toLowerCase()}s`,
      folderScoped: false,
      getLabel: () => label,
      getPluralLabel: () => `${label}s`,
      icon: 'tag-alt',
    };
  }

  it('finds a kind that a plugin adds by its group and kind', () => {
    const note = appKind('Note', 'Note');
    addKinds([note]);

    expect(findKind(group, 'Note')).toBe(note);
    expect(findKind('other.ext.grafana.app', 'Note')).toBeUndefined();
    expect(findKindByResource('notes', group)).toBe(note);
    expect(getKinds()).toEqual(expect.arrayContaining([CORE_KINDS.dashboard, note]));
  });

  it('keeps the core row when a plugin adds a kind that Grafana serves', () => {
    addKinds([{ ...appKind('Dashboard', 'Plugin dashboard'), group: 'dashboard.grafana.app' }]);

    expect(findKind('dashboard.grafana.app', 'Dashboard')).toBe(CORE_KINDS.dashboard);
    expect(getAppKinds().some((kind) => kind.kind === 'Dashboard')).toBe(false);
  });

  it('replaces a kind that a plugin adds again', () => {
    addKinds([appKind('Widget', 'Old widget')]);
    addKinds([appKind('Widget', 'New widget')]);

    expect(getAppKinds().filter((kind) => kind.kind === 'Widget')).toHaveLength(1);
    expect(findKind(group, 'Widget')?.getLabel()).toBe('New widget');
  });
});
