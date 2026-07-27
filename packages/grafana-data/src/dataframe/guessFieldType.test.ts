import { dateTime } from '../datetime/moment_wrapper';
import { FieldType, type Field } from '../types/dataFrame';

import {
  getFieldTypeFromValue,
  guessFieldTypeForField,
  guessFieldTypeFromValue,
  guessFieldTypes,
} from './guessFieldType';
import { createDataFrame } from './processDataFrame';

describe('guessFieldTypeFromValue', () => {
  it('Guess Column Types from value', () => {
    expect(guessFieldTypeFromValue(1)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(1.234)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(3.125e7)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(true)).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue(false)).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue(new Date())).toBe(FieldType.time);
    expect(guessFieldTypeFromValue(dateTime())).toBe(FieldType.time);
  });

  it('Guess Column Types from strings', () => {
    expect(guessFieldTypeFromValue('1')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('1.234')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('NaN')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('3.125e7')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('True')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('FALSE')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('true')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('xxxx')).toBe(FieldType.string);
  });
});

describe('getFieldTypeFromValue', () => {
  it('Get column types from values', () => {
    expect(getFieldTypeFromValue(1)).toBe(FieldType.number);
    expect(getFieldTypeFromValue(1.234)).toBe(FieldType.number);
    expect(getFieldTypeFromValue(NaN)).toBe(FieldType.number);
    expect(getFieldTypeFromValue(3.125e7)).toBe(FieldType.number);
    expect(getFieldTypeFromValue(true)).toBe(FieldType.boolean);
    expect(getFieldTypeFromValue('xxxx')).toBe(FieldType.string);
  });
});

describe('guessFieldTypeForField', () => {
  it('should guess types if value exists', () => {
    const field: Field = {
      name: 'Field',
      config: {},
      type: FieldType.other,
      values: [1, 2, 3],
    };

    expect(guessFieldTypeForField(field)).toBe(FieldType.number);

    field.values = [null, null, 3];

    expect(guessFieldTypeForField(field)).toBe(FieldType.number);
  });

  it('should guess type if name suggests time values', () => {
    const field: Field = {
      name: 'Date',
      config: {},
      type: FieldType.other,
      values: [1, 2, 3],
    };

    expect(guessFieldTypeForField(field)).toBe(FieldType.time);

    field.name = 'time';

    expect(guessFieldTypeForField(field)).toBe(FieldType.time);
  });

  it('should return undefined if no values present', () => {
    const field: Field = {
      name: 'Val',
      config: {},
      type: FieldType.other,
      values: [null, null],
    };

    expect(guessFieldTypeForField(field)).toBe(undefined);

    field.values = [];

    expect(guessFieldTypeForField(field)).toBe(undefined);
  });
});

describe('guessFieldTypes', () => {
  it('Guess Column Types from series', () => {
    const series = createDataFrame({
      fields: [
        { name: 'A (number)', values: [123, null] },
        { name: 'B (strings)', values: [null, 'Hello'] },
        { name: 'C (nulls)', values: [null, null] },
        { name: 'Time', values: ['2000', 1967] },
        { name: 'D (number strings)', values: ['NaN', null, 1] },
      ],
    });
    const norm = guessFieldTypes(series);
    expect(norm.fields[0].type).toBe(FieldType.number);
    expect(norm.fields[1].type).toBe(FieldType.string);
    expect(norm.fields[2].type).toBe(FieldType.other);
    expect(norm.fields[3].type).toBe(FieldType.time); // based on name
    expect(norm.fields[4].type).toBe(FieldType.number);
  });
});
