import { isPredefinedOrigin, toControlSourceRef } from './predefinedVariableOrigin';

describe('isPredefinedOrigin', () => {
  it('recognizes global and folder origins', () => {
    expect(isPredefinedOrigin(toControlSourceRef({ type: 'global' }))).toBe(true);
    expect(isPredefinedOrigin(toControlSourceRef({ type: 'folder', folderUid: 'f1' }))).toBe(true);
  });

  it('rejects datasource origins and empty values', () => {
    expect(isPredefinedOrigin({ type: 'datasource', group: 'prometheus' })).toBe(false);
    expect(isPredefinedOrigin(undefined)).toBe(false);
    expect(isPredefinedOrigin(null)).toBe(false);
  });
});
