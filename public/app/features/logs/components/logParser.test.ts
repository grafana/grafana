import { ArrayVector, FieldType, MutableDataFrame } from '@grafana/data';

import { createLogRow } from './__mocks__/logRow';
import { getAllFields } from './logParser';

describe('getAllFields', () => {
  it('should filter out field with labels name and other type', () => {
    const logRow = createLogRow({
      entryFieldIndex: 10,
      dataFrame: new MutableDataFrame({
        refId: 'A',
        fields: [
          testStringField,
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: new ArrayVector([{ place: 'luna', source: 'data' }]),
          },
        ],
      }),
    });

    const fields = getAllFields(logRow);
    expect(fields.length).toBe(1);
    expect(fields.find((field) => field.keys[0] === 'labels')).toBe(undefined);
  });

  it('should not filter out field with labels name and string type', () => {
    const logRow = createLogRow({
      entryFieldIndex: 10,
      dataFrame: new MutableDataFrame({
        refId: 'A',
        fields: [
          testStringField,
          {
            name: 'labels',
            type: FieldType.string,
            config: {},
            values: new ArrayVector([{ place: 'luna', source: 'data' }]),
          },
        ],
      }),
    });
    const fields = getAllFields(logRow);
    expect(fields.length).toBe(2);
    expect(fields.find((field) => field.keys[0] === 'labels')).not.toBe(undefined);
  });

  it('should filter out field with id name', () => {
    const logRow = createLogRow({
      entryFieldIndex: 10,
      dataFrame: new MutableDataFrame({
        refId: 'A',
        fields: [
          testStringField,
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: new ArrayVector(['1659620138401000000_8b1f7688_']),
          },
        ],
      }),
    });

    const fields = getAllFields(logRow);
    expect(fields.length).toBe(1);
    expect(fields.find((field) => field.keys[0] === 'id')).toBe(undefined);
  });

  it('should filter out field with config hidden field', () => {
    const testField = { ...testStringField };
    testField.config = {
      custom: {
        hidden: true,
      },
    };
    const logRow = createLogRow({
      entryFieldIndex: 10,
      dataFrame: new MutableDataFrame({
        refId: 'A',
        fields: [{ ...testField }],
      }),
    });

    const fields = getAllFields(logRow);
    expect(fields.length).toBe(0);
    expect(fields.find((field) => field.keys[0] === testField.name)).toBe(undefined);
  });

  it('should filter out field with null values', () => {
    const logRow = createLogRow({
      entryFieldIndex: 10,
      dataFrame: new MutableDataFrame({
        refId: 'A',
        fields: [{ ...testFieldWithNullValue }],
      }),
    });

    const fields = getAllFields(logRow);
    expect(fields.length).toBe(0);
    expect(fields.find((field) => field.keys[0] === testFieldWithNullValue.name)).toBe(undefined);
  });

  it('should not filter out field with string values', () => {
    const logRow = createLogRow({
      entryFieldIndex: 10,
      dataFrame: new MutableDataFrame({
        refId: 'A',
        fields: [{ ...testStringField }],
      }),
    });

    const fields = getAllFields(logRow);
    expect(fields.length).toBe(1);
    expect(fields.find((field) => field.keys[0] === testStringField.name)).not.toBe(undefined);
  });
});

const testStringField = {
  name: 'test_field_string',
  type: FieldType.string,
  config: {},
  values: new ArrayVector(['abc']),
};

const testFieldWithNullValue = {
  name: 'test_field_null',
  type: FieldType.string,
  config: {},
  values: new ArrayVector([null]),
};
