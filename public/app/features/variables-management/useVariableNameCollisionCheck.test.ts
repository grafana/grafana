import { evaluateVariableNameCollision } from './useVariableNameCollisionCheck';
import { deriveVariableMetadataName } from './utils';

describe('deriveVariableMetadataName', () => {
  it('returns the logical name for global scope', () => {
    expect(deriveVariableMetadataName('region')).toBe('region');
    expect(deriveVariableMetadataName('region', '')).toBe('region');
  });

  it('appends --folderUid for folder scope', () => {
    expect(deriveVariableMetadataName('region', 'folder-a')).toBe('region--folder-a');
  });
});

describe('evaluateVariableNameCollision', () => {
  it('reports nameTaken when getVariable returns a resource', () => {
    expect(
      evaluateVariableNameCollision({
        shouldQuery: true,
        isFetching: false,
        isDebouncing: false,
        data: { metadata: { name: 'region' } },
        error: undefined,
      })
    ).toEqual({ isChecking: false, nameTaken: true });
  });

  it('does not treat a 404 as taken', () => {
    expect(
      evaluateVariableNameCollision({
        shouldQuery: true,
        isFetching: false,
        isDebouncing: false,
        data: undefined,
        error: { status: 404 },
      })
    ).toEqual({ isChecking: false, nameTaken: false });
  });

  it('fails open on non-404 errors', () => {
    expect(
      evaluateVariableNameCollision({
        shouldQuery: true,
        isFetching: false,
        isDebouncing: false,
        data: undefined,
        error: { status: 500 },
      })
    ).toEqual({ isChecking: false, nameTaken: false });
  });

  it('is checking while the query is in flight', () => {
    expect(
      evaluateVariableNameCollision({
        shouldQuery: true,
        isFetching: true,
        isDebouncing: false,
        data: undefined,
        error: undefined,
      })
    ).toEqual({ isChecking: true, nameTaken: false });
  });

  it('is checking while the name is debouncing', () => {
    expect(
      evaluateVariableNameCollision({
        shouldQuery: false,
        isFetching: false,
        isDebouncing: true,
        data: undefined,
        error: undefined,
      })
    ).toEqual({ isChecking: true, nameTaken: false });
  });

  it('does not report taken when the query was skipped', () => {
    expect(
      evaluateVariableNameCollision({
        shouldQuery: false,
        isFetching: false,
        isDebouncing: false,
        data: { metadata: { name: 'region' } },
        error: undefined,
      })
    ).toEqual({ isChecking: false, nameTaken: false });
  });
});
