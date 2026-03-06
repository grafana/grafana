// Note: QueryEditorContextWrapper itself (the React component) is tested indirectly via
// component-level integration tests. This file only unit-tests the pure helper functions
// exported from the module.
import { getNextSelectedQueryRefId, getNextSelectedQueryRefIds } from './QueryEditorContextWrapper';

describe('getNextSelectedQueryRefIds', () => {
  it('updates the renamed refId in the selection array', () => {
    expect(getNextSelectedQueryRefIds(['A', 'X', 'B'], 'X', 'Z')).toEqual(['A', 'Z', 'B']);
  });

  it('keeps all refIds unchanged when the renamed query is not in the selection', () => {
    expect(getNextSelectedQueryRefIds(['A', 'B'], 'Y', 'Z')).toEqual(['A', 'B']);
  });

  it('returns an empty array when selection is empty', () => {
    expect(getNextSelectedQueryRefIds([], 'Y', 'Z')).toEqual([]);
  });

  it('handles a single-element selection of the renamed query', () => {
    expect(getNextSelectedQueryRefIds(['X'], 'X', 'Z')).toEqual(['Z']);
  });
});

describe('getNextSelectedQueryRefId (deprecated)', () => {
  it('updates selection to the renamed refId when the renamed query is selected', () => {
    expect(getNextSelectedQueryRefId('X', 'X', 'Z')).toBe('Z');
  });

  it('keeps selection unchanged when another query is renamed', () => {
    expect(getNextSelectedQueryRefId('X', 'Y', 'Z')).toBe('X');
  });

  it('keeps null selection unchanged', () => {
    expect(getNextSelectedQueryRefId(null, 'Y', 'Z')).toBeNull();
  });
});
