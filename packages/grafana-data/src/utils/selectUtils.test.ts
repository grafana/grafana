import { enumToOptions, toOption, toOptions } from './selectUtils';

describe('toOption', () => {
  it('uses the value as its own label', () => {
    expect(toOption('foo')).toEqual({ label: 'foo', value: 'foo' });
  });

  it('stringifies non-string values for the label', () => {
    expect(toOption(42)).toEqual({ label: '42', value: 42 });
  });
});

describe('toOptions', () => {
  it('maps a string array to options', () => {
    expect(toOptions(['a', 'b'])).toEqual([
      { label: 'a', value: 'a' },
      { label: 'b', value: 'b' },
    ]);
  });

  it('returns an empty array for an empty input', () => {
    expect(toOptions([])).toEqual([]);
  });
});

describe('enumToOptions', () => {
  it('converts a string enum', () => {
    enum Fruit {
      Apple = 'apple',
      Banana = 'banana',
    }

    expect(enumToOptions(Fruit)).toEqual([
      { label: 'apple', value: 'apple' },
      { label: 'banana', value: 'banana' },
    ]);
  });

  it('drops reverse-mapping keys for numeric enums', () => {
    enum Size {
      Small,
      Large,
    }

    expect(enumToOptions(Size)).toEqual([
      { label: '0', value: 0 },
      { label: '1', value: 1 },
    ]);
  });

  it('applies a custom label function', () => {
    enum Fruit {
      Apple = 'apple',
      Banana = 'banana',
    }

    expect(enumToOptions(Fruit, (v) => v.toUpperCase())).toEqual([
      { label: 'APPLE', value: 'apple' },
      { label: 'BANANA', value: 'banana' },
    ]);
  });
});
