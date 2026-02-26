import { getNextSelectedQueryRefId } from './QueryEditorContextWrapper';

describe('getNextSelectedQueryRefId', () => {
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
