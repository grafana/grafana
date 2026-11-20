import { CORE_KINDS, coversGroup, findKind } from './coreKinds';

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
    expect(findKind('dashboard.grafana.app', 'LibraryPanel')).toBe(CORE_KINDS.librarypanel);
  });

  it('finds nothing for a kind the group does not serve', () => {
    expect(findKind('dashboard.grafana.app', 'Playlist')).toBeUndefined();
  });
});
