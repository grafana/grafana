import WKT from 'ol/format/WKT';
import { Point, type Geometry } from 'ol/geom';

import { createDataFrame, FieldType, type Field } from '@grafana/data';

import { TableCellDisplayMode } from '../../types';

import { buildInspectValue, displayJsonValue, parseStyleJson, prepareSparklineValue } from './values';

describe('displayJsonValue', () => {
  let field: Field;
  beforeEach(() => {
    field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      state: { displayName: 'Test Display Name' },
      values: [],
      display: (val: unknown) => ({ text: String(val), numeric: NaN }),
    };
  });

  it('should parse and then stringify string values', () => {
    expect(displayJsonValue(field)('{"valid": "json"}').text).toBe('{\n "valid": "json"\n}');
  });

  it('should not throw for non-serializable string values', () => {
    expect(displayJsonValue(field)('{"invalid": "json').text).toBe('{"invalid": "json');
  });

  it('should stringify non-string values', () => {
    expect(displayJsonValue(field)(42).text).toBe('42');
  });

  it('should use the underlying field.display method to format values and return numeric values', () => {
    field.display = (val: unknown) => ({ text: `**${val}**`, numeric: Number(val), suffix: 'ms' });
    expect(displayJsonValue(field)(42).text).toBe('**42**ms');
    expect(displayJsonValue(field)(42).numeric).toBe(42);
  });

  it('should not mangle objects into [object Object]', () => {
    expect(displayJsonValue(field)({ a: 1, b: 2 }).text).toBe('{\n "a": 1,\n "b": 2\n}');
  });

  it('should render arrays as JSON', () => {
    expect(displayJsonValue(field)([1, 2, 3]).text).toBe('[\n 1,\n 2,\n 3\n]');
  });
});

describe('parseStyleJson', () => {
  it('parses the contents of the styleField for this row and returns a style object', () => {
    expect(parseStyleJson('{"color":"red"}')).toEqual({ color: 'red' });
  });

  it.each([
    { type: 'number', value: 12345 },
    { type: 'boolean', value: true },
    { type: 'null', value: null },
    { type: 'undefined', value: undefined },
    { type: 'object', value: { color: 'red' } },
    { type: 'array', value: ['not', 'a', 'string'] },
  ])('returns void if input is a $type', ({ value }) => {
    expect(parseStyleJson(value)).toBeUndefined();
  });

  it.each([
    { type: 'array', value: '["not","an","object"]' },
    { type: 'string', value: '"just a string"' },
    { type: 'number', value: '12345' },
    { type: 'boolean', value: 'true' },
    { type: 'null', value: 'null' },
  ])('returns void and does not throw if the parsed JSON is a $type', ({ value }) => {
    expect(parseStyleJson(value)).toBeUndefined();
  });

  it('returns void and does not throw if this is invalid JSON (but it does console.error)', () => {
    jest.spyOn(console, 'error').mockImplementation();
    expect(parseStyleJson('{"mal": "formed}')).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('only calls console.error once for a given malformed style', () => {
    jest.spyOn(console, 'error').mockImplementation();
    for (let i = 0; i < 100; i++) {
      parseStyleJson('{"mal": "formed-in-a-new-way}');
    }
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('returns an object with invalid style properties, because we do not validate the style properties', () => {
    expect(parseStyleJson('{"notARealStyle": "someValue"}')).toEqual({ notARealStyle: 'someValue' });
  });
});

describe('prepareSparklineValue', () => {
  it('should return an array of numbers when given an array of numbers', () => {
    expect(
      prepareSparklineValue([1, 2, 3, 4, 5], {
        name: 'test',
        type: FieldType.number,
        values: [1, 2, 3, 4, 5],
        config: {},
      })
    ).toEqual({
      y: {
        name: `test-sparkline`,
        type: FieldType.number,
        values: [1, 2, 3, 4, 5],
        config: {},
      },
    });
  });

  it('should parse the x and y values from a dataframe', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'x', type: FieldType.time, values: [0, 1000, 2000, 3000, 4000] },
        { name: 'y', type: FieldType.number, values: [10, 20, 30, 40, 50] },
      ],
    });
    expect(
      prepareSparklineValue(frame, {
        name: 'test',
        type: FieldType.frame,
        values: [frame],
        config: {},
      })
    ).toEqual({
      x: {
        name: 'x',
        type: FieldType.time,
        values: [0, 1000, 2000, 3000, 4000],
        config: {},
      },
      y: {
        name: 'y',
        type: FieldType.number,
        values: [10, 20, 30, 40, 50],
        config: {},
      },
    });
  });

  it('should return undefined for non-array and non-dataframe values', () => {
    expect(
      prepareSparklineValue('not an array or dataframe', {
        name: 'test',
        type: FieldType.string,
        values: ['a', 'b', 'c'],
        config: {},
      })
    ).toBeUndefined();
  });
});

describe('buildInspectValue', () => {
  const numberFieldWithNulls: Field = {
    name: 'numbers-with-nulls',
    type: FieldType.number,
    values: [0, 1, 2, null, NaN],
    config: {},
  };
  const stringField: Field = {
    name: 'string',
    type: FieldType.string,
    values: ['foo', 'bar', 'baz', null],
    config: {},
  };
  const jsonStringField: Field = {
    ...stringField,
    values: ['{"valid": "json"}', '{"invalid": "json', null, '{"another": "one"}'],
    config: { custom: { cellOptions: { type: TableCellDisplayMode.JSONView } } },
  };
  const booleanField: Field = {
    name: 'boolean-field',
    type: FieldType.boolean,
    values: [true, false, true],
    config: {},
  };
  const sparklineField: Field = {
    name: 'sparkline-field',
    type: FieldType.frame,
    values: [
      createDataFrame({
        fields: [
          { name: 'x', type: FieldType.time, values: [0, 1000, 2000] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ],
    config: {},
  };
  const sparklineFieldNoX: Field = {
    name: 'sparkline-field-no-x',
    type: FieldType.other,
    values: [[2, 4, 6, 8, 10]],
    config: {
      custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } },
    },
  };
  const arrayField: Field = {
    name: 'array-field',
    type: FieldType.other,
    values: [
      ['foo', 'bar', 'baz'],
      ['one', 'two', 'three'],
    ],
    config: {},
  };
  const objectField: Field = {
    name: 'array-field',
    type: FieldType.other,
    values: [
      { foo: true, b: 'baz' },
      { foo: false, b: 'qux' },
    ],
    config: {},
  };
  const geoField: Field = {
    name: 'geo-field',
    type: FieldType.geo,
    values: [new Point([0, -74.1])],
    config: {},
  };
  const geoFieldInvalid: Field = {
    name: 'geo-field',
    type: FieldType.geo,
    values: ['6y4h9b'],
    config: {},
  };

  const formatGeometry = (val: Geometry) =>
    new WKT().writeGeometry(val, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });

  it.each([
    { name: 'numbers', input: { valueIdx: 0, field: numberFieldWithNulls } },
    { name: 'string', input: { valueIdx: 0, field: stringField } },
    { name: 'string w/ JSON', input: { valueIdx: 0, field: jsonStringField } },
    { name: 'string w/ JSON (invalid JSON)', input: { valueIdx: 1, field: jsonStringField } },
    { name: 'boolean', input: { valueIdx: 0, field: booleanField } },
    { name: 'NaN', input: { valueIdx: 4, field: numberFieldWithNulls } },
    { name: 'null', input: { valueIdx: 3, field: numberFieldWithNulls } },
    { name: 'null w/ JSON', input: { valueIdx: 2, field: jsonStringField } },
    { name: 'undefined', input: { valueIdx: 6, field: numberFieldWithNulls } },
    { name: 'sparkline', input: { valueIdx: 0, field: sparklineField } },
    { name: 'sparkline (no x)', input: { valueIdx: 0, field: sparklineFieldNoX } },
    { name: 'array', input: { valueIdx: 0, field: arrayField } },
    { name: 'object', input: { valueIdx: 0, field: objectField } },
    { name: 'geo', input: { valueIdx: 0, field: geoField, formatGeometry } },
    { name: 'geo w/out formatGeometry', input: { valueIdx: 0, field: geoField } },
    { name: 'geo w/ invalid format', input: { valueIdx: 0, field: geoFieldInvalid, formatGeometry } },
  ])('should handle $name', ({ input: { field, valueIdx = 0, formatGeometry } }) => {
    expect(buildInspectValue(field.values[valueIdx], field, formatGeometry)).toMatchSnapshot();
  });
});
