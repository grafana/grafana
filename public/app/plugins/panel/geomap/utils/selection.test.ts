import { getSelectionInfo } from './selection';

describe('getSelectionInfo', () => {
  it('should synthesize a single option when a value is set but no option list is passed', () => {
    const { options, current } = getSelectionInfo('coords');
    expect(options).toHaveLength(1);
    expect(current).toEqual({ label: 'coords', value: 'coords' });
  });

  it('should return empty options when no value and no options', () => {
    const { options, current } = getSelectionInfo(undefined);
    expect(options).toEqual([]);
    expect(current).toBeUndefined();
  });

  it('should select the matching option when the value exists in the list', () => {
    const { options, current } = getSelectionInfo('b', [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ]);
    expect(options).toHaveLength(2);
    expect(current).toEqual({ label: 'B', value: 'b' });
  });

  it('should append a synthetic option when the value is missing from the list', () => {
    const { options, current } = getSelectionInfo('legacy', [{ label: 'A', value: 'a' }]);
    expect(options).toHaveLength(2);
    expect(current).toEqual({ label: 'legacy (not found)', value: 'legacy' });
  });
});
