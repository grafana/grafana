import { CORE_KINDS } from './coreKinds';

describe('getRoute', () => {
  it('encodes the object name', () => {
    expect(CORE_KINDS.folder.getRoute('a b/c')).toBe('/dashboards/f/a%20b%2Fc');
  });

  it('leaves the path after the name as written', () => {
    expect(CORE_KINDS.connection.getRoute('a b/c')).toBe('/admin/provisioning/connections/a%20b%2Fc/edit');
  });
});
