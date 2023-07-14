import { UniqueKeyMaker } from './UniqueKeyMaker';

describe('UniqueKeyMaker', () => {
  const expectKeys = (testData: Array<[string, string]>) => {
    const k = new UniqueKeyMaker();
    testData.forEach(([input, output]) => {
      expect(k.getKey(input)).toBe(output);
    });

    // we also make a check that all the output-values are unique
    const outputs = testData.map(([i, o]) => o);
    const uniqueOutputLength = new Set(outputs).size;
    expect(uniqueOutputLength).toBe(outputs.length);
  };

  it('should handle already unique keys', () => {
    expectKeys([
      ['one', 'k_one'],
      ['two', 'k_two'],
      ['three', 'k_three'],
    ]);
  });

  it('should handle duplicate keys', () => {
    expectKeys([
      ['one', 'k_one'],
      ['one', 'i_2'],
      ['one', 'i_3'],
    ]);
  });

  it('should handle a mix of unique and duplicate keys', () => {
    expectKeys([
      ['one', 'k_one'],
      ['two', 'k_two'],
      ['one', 'i_3'],
      ['two', 'i_4'],
      ['three', 'k_three'],
    ]);
  });
});
