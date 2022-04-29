import { getValuesFromQueryParams } from './getValuesFromQueryParams';

describe('getValuesFromQueryParams', () => {
  it('should return empty array if no keys passed', () => {
    expect(getValuesFromQueryParams({}, [])).toEqual([]);
  });

  it('should return empty array if key is not on params', () => {
    expect(getValuesFromQueryParams({}, [{ key: 'category' }])).toEqual([]);
  });

  it('should use the default transform if none is passed', () => {
    const [categories, types] = getValuesFromQueryParams<[string[], string[]]>({ category: 'perf', type: 'foo' }, [
      { key: 'category' },
      { key: 'type' },
    ]);
    expect(categories).toEqual(['perf']);
    expect(types).toEqual(['foo']);
  });

  it('should use custom transforms', () => {
    const [hasType, valid] = getValuesFromQueryParams<[string[], boolean]>({ hasType: true, valid: true }, [
      { key: 'hasType' },
      { key: 'valid', transform: (param) => !!param },
    ]);
    expect(hasType).toEqual(['true']);
    expect(valid).toEqual(true);
  });
});
