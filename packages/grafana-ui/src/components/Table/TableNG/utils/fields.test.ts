import { createDataFrame, FieldType, type DataFrame, type Field } from '@grafana/data';

import { extractPixelValue, getColumnTypes, getDisplayName, predicateByName } from './fields';

describe('getColumnTypes', () => {
  it('builds the expected record with column types', () => {
    const fields: Field[] = [
      {
        name: 'name',
        type: FieldType.string,
        display: (v) => ({ text: v as string, numeric: NaN }),
        config: {},
        values: [],
      },
      {
        name: 'age',
        type: FieldType.number,
        display: (v) => ({ text: (v as number).toString(), numeric: v as number }),
        config: {},
        values: [],
      },
      {
        name: 'active',
        type: FieldType.boolean,
        display: (v) => ({ text: (v as boolean).toString(), numeric: NaN }),
        config: {},
        values: [],
      },
    ];
    const result = getColumnTypes(fields);

    expect(result).toEqual({ name: FieldType.string, age: FieldType.number, active: FieldType.boolean });
  });

  it('should recursively build column types when nested fields are present', () => {
    const frame: DataFrame = {
      fields: [
        { type: FieldType.string, name: 'stringCol', config: {}, values: [] },
        {
          type: FieldType.nestedFrames,
          name: 'nestedCol',
          config: {},
          values: [
            [
              createDataFrame({
                fields: [
                  { name: 'time', values: [1, 2] },
                  { name: 'value', values: [10, 20] },
                ],
              }),
            ],
            [
              createDataFrame({
                fields: [
                  { name: 'time', values: [3, 4] },
                  { name: 'value', values: [30, 40] },
                ],
              }),
            ],
          ],
        },
      ],
      length: 0,
      name: 'test',
    };

    expect(getColumnTypes(frame.fields)).toEqual({
      stringCol: FieldType.string,
      time: FieldType.time,
      value: FieldType.number,
    });
  });

  it('does not throw if nestedFrames has no values', () => {
    const frame: DataFrame = {
      fields: [
        { type: FieldType.string, name: 'stringCol', config: {}, values: [] },
        { type: FieldType.nestedFrames, name: 'nestedCol', config: {}, values: [] },
      ],
      length: 0,
      name: 'test',
    };

    expect(getColumnTypes(frame.fields)).toEqual({ stringCol: FieldType.string });
  });
});

describe('extractPixelValue', () => {
  it('should extract numeric value from pixel string', () => {
    expect(extractPixelValue('100px')).toBe(100);
    expect(extractPixelValue('42px')).toBe(42);
    expect(extractPixelValue('0px')).toBe(0);
  });

  it('should handle numeric input', () => {
    expect(extractPixelValue(100)).toBe(100);
    expect(extractPixelValue(42)).toBe(42);
    expect(extractPixelValue(0)).toBe(0);
  });

  it('should handle string numbers without units', () => {
    expect(extractPixelValue('100')).toBe(100);
    expect(extractPixelValue('42')).toBe(42);
    expect(extractPixelValue('0')).toBe(0);
  });

  it('should handle decimal values', () => {
    expect(extractPixelValue('100.5px')).toBe(100.5);
    expect(extractPixelValue('42.75px')).toBe(42.75);
    expect(extractPixelValue(100.5)).toBe(100.5);
  });

  it('should handle negative values', () => {
    expect(extractPixelValue('-100px')).toBe(-100);
    expect(extractPixelValue('-42px')).toBe(-42);
    expect(extractPixelValue(-100)).toBe(-100);
  });

  it('should handle other CSS units by removing them', () => {
    expect(extractPixelValue('100em')).toBe(100);
    expect(extractPixelValue('42rem')).toBe(42);
    expect(extractPixelValue('10vh')).toBe(10);
    expect(extractPixelValue('20vw')).toBe(20);
  });

  it('should handle whitespace', () => {
    expect(extractPixelValue(' 100px ')).toBe(100);
    expect(extractPixelValue(' 42 px ')).toBe(42);
  });

  it('should return 0 for invalid input when no default is provided', () => {
    expect(extractPixelValue('not-a-number')).toBe(0);
    expect(extractPixelValue('px')).toBe(0);
    expect(extractPixelValue('')).toBe(0);
  });
});

describe('getDisplayName', () => {
  it('should return the display name if set', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      state: { displayName: 'Test Display Name' },
      values: [],
    };
    expect(getDisplayName(field)).toBe('Test Display Name');
  });

  it('should return the field name if no display name is set', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.string,
      state: {},
      config: {},
      values: [],
    };
    expect(getDisplayName(field)).toBe('test');
  });
});

describe('predicateByName', () => {
  it('should return true for matching field names', () => {
    const field: Field = { name: 'test', type: FieldType.string, config: {}, values: [] };
    const predicate = predicateByName('test');
    expect(predicate(field)).toBe(true);
  });

  it('should return true for a matching display name', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      state: { displayName: 'Test Display Name' },
      values: [],
    };
    const predicate = predicateByName('Test Display Name');
    expect(predicate(field)).toBe(true);
  });

  it('should return false for non-matching field names', () => {
    const field: Field = { name: 'test', type: FieldType.string, config: {}, values: [] };
    const predicate = predicateByName('other');
    expect(predicate(field)).toBe(false);
  });
});
