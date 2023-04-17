import { toDataFrame } from '../../dataframe/processDataFrame';
import { Field, FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

import {
  ensureTimeField,
  convertFieldType,
  convertFieldTypes,
  convertFieldTypeTransformer,
  fieldToTimeField,
} from './convertFieldType';

describe('field convert type', () => {
  it('will parse properly formatted strings to time', () => {
    const options = { targetField: 'proper dates', destinationType: FieldType.time };

    const stringTime = {
      name: 'proper dates',
      type: FieldType.string,
      values: [
        '2021-07-19 00:00:00.000',
        '2021-07-23 00:00:00.000',
        '2021-07-25 00:00:00.000',
        '2021-08-01 00:00:00.000',
        '2021-08-02 00:00:00.000',
      ],
      config: {},
    };

    const timefield = convertFieldType(stringTime, options);
    expect(timefield).toEqual({
      name: 'proper dates',
      type: FieldType.time,
      values: [1626674400000, 1627020000000, 1627192800000, 1627797600000, 1627884000000],
      config: {},
    });
  });
  it('will parse string time to specified format in time', () => {
    const options = { targetField: 'format to year', destinationType: FieldType.time, dateFormat: 'YYYY' };

    const yearFormat = {
      name: 'format to year',
      type: FieldType.string,
      values: [
        '2017-07-19 00:00:00.000',
        '2018-07-23 00:00:00.000',
        '2019-07-25 00:00:00.000',
        '2020-08-01 00:00:00.000',
        '2021-08-02 00:00:00.000',
      ],
      config: {},
    };

    const timefield = convertFieldType(yearFormat, options);
    expect(timefield).toEqual({
      name: 'format to year',
      type: FieldType.time,
      values: [1483246800000, 1514782800000, 1546318800000, 1577854800000, 1609477200000],
      config: {},
    });
  });

  it('will not parse improperly formatted date strings', () => {
    const options = { targetField: 'misformatted dates', destinationType: FieldType.time };

    const misformattedStrings = {
      name: 'misformatted dates',
      type: FieldType.string,
      values: ['2021/08-01 00:00.00:000', '2021/08/01 00.00-000', '2021/08-01 00:00.00:000'],
      config: { unit: 'time' },
    };

    const timefield = convertFieldType(misformattedStrings, options);
    expect(timefield).toEqual({
      name: 'misformatted dates',
      type: FieldType.time,
      values: [null, null, null],
      config: { unit: 'time' },
    });
  });

  it('can convert strings to numbers', () => {
    const options = { targetField: 'stringy nums', destinationType: FieldType.number };

    const stringyNumbers = {
      name: 'stringy nums',
      type: FieldType.string,
      values: ['10', '12', '30', '14', '10'],
      config: {},
    };

    const numbers = convertFieldType(stringyNumbers, options);

    expect(numbers).toEqual({
      name: 'stringy nums',
      type: FieldType.number,
      values: [10, 12, 30, 14, 10],
      config: {},
    });
  });
});

it('can convert strings with commas to numbers', () => {
  const options = { targetField: 'stringy nums', destinationType: FieldType.number };

  const stringyNumbers = {
    name: 'stringy nums',
    type: FieldType.string,
    values: ['1,000', '1,000,000', null, undefined, '', '1'],
    config: {},
  };

  const numbers = convertFieldType(stringyNumbers, options);

  expect(numbers).toEqual({
    name: 'stringy nums',
    type: FieldType.number,
    values: [1000, 1000000, 0, null, 0, 1],
    config: {},
  });
});

it('converts booleans to numbers', () => {
  const options = { targetField: 'booleans', destinationType: FieldType.number };

  const stringyNumbers = {
    name: 'booleans',
    type: FieldType.boolean,
    values: [true, false],
    config: {},
  };

  const numbers = convertFieldType(stringyNumbers, options);

  expect(numbers).toEqual({
    name: 'booleans',
    type: FieldType.number,
    values: [1, 0],
    config: {},
  });
});

describe('field convert types transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([convertFieldTypeTransformer]);
  });
  it('can convert multiple fields', () => {
    const options = {
      conversions: [
        { targetField: 'stringy nums', destinationType: FieldType.number },
        { targetField: 'proper dates', destinationType: FieldType.time },
      ],
    };

    const stringyNumbers = toDataFrame({
      fields: [
        { name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
        {
          name: 'proper dates',
          type: FieldType.string,
          values: [
            '2021-07-19 00:00:00.000',
            '2021-07-23 00:00:00.000',
            '2021-07-25 00:00:00.000',
            '2021-08-01 00:00:00.000',
            '2021-08-02 00:00:00.000',
          ],
        },
        { name: 'stringy nums', type: FieldType.string, values: ['10', '12', '30', '14', '10'] },
      ],
    });

    const numbers = convertFieldTypes(options, [stringyNumbers]);
    expect(
      numbers[0].fields.map((f) => ({
        type: f.type,
        values: f.values.toArray(),
      }))
    ).toEqual([
      { type: FieldType.number, values: [1, 2, 3, 4, 5] },
      {
        type: FieldType.time,
        values: [1626674400000, 1627020000000, 1627192800000, 1627797600000, 1627884000000],
      },
      {
        type: FieldType.number,
        values: [10, 12, 30, 14, 10],
      },
    ]);
  });

  it('will convert field to booleans', () => {
    const options = {
      conversions: [
        { targetField: 'numbers', destinationType: FieldType.boolean },
        { targetField: 'strings', destinationType: FieldType.boolean },
      ],
    };

    const comboTypes = toDataFrame({
      fields: [
        { name: 'numbers', type: FieldType.number, values: [-100, 0, 1, null, NaN] },
        {
          name: 'strings',
          type: FieldType.string,
          values: ['true', 'false', '0', '99', '2021-08-02 00:00:00.000'],
        },
      ],
    });

    const booleans = convertFieldTypes(options, [comboTypes]);
    expect(
      booleans[0].fields.map((f) => ({
        type: f.type,
        values: f.values.toArray(),
      }))
    ).toEqual([
      {
        type: FieldType.boolean,
        values: [true, false, true, false, false],
      },
      { type: FieldType.boolean, values: [true, true, true, true, true] },
    ]);
  });

  it('will convert field to complex objects', () => {
    const options = {
      conversions: [
        { targetField: 'numbers', destinationType: FieldType.other },
        { targetField: 'objects', destinationType: FieldType.other },
        { targetField: 'arrays', destinationType: FieldType.other },
        { targetField: 'invalids', destinationType: FieldType.other },
        { targetField: 'mixed', destinationType: FieldType.other },
      ],
    };

    const comboTypes = toDataFrame({
      fields: [
        {
          name: 'numbers',
          type: FieldType.number,
          values: [-1, 1, null],
        },
        {
          name: 'objects',
          type: FieldType.string,
          values: [
            '{ "neg": -100, "zero": 0, "pos": 1, "null": null, "array": [0, 1, 2], "nested": { "number": 1 } }',
            '{ "string": "abcd" }',
            '{}',
          ],
        },
        {
          name: 'arrays',
          type: FieldType.string,
          values: ['[true]', '[99]', '["2021-08-02 00:00:00.000"]'],
        },
        {
          name: 'invalids',
          type: FieldType.string,
          values: ['abcd', '{ invalidJson }', '[unclosed array'],
        },
        {
          name: 'mixed',
          type: FieldType.string,
          values: [
            '{ "neg": -100, "zero": 0, "pos": 1, "null": null, "array": [0, 1, 2], "nested": { "number": 1 } }',
            '["a string", 1234, {"a complex": "object"}]',
            '["this is invalid JSON]',
          ],
        },
      ],
    });

    const complex = convertFieldTypes(options, [comboTypes]);
    expect(
      complex[0].fields.map((f) => ({
        type: f.type,
        values: f.values.toArray(),
      }))
    ).toEqual([
      {
        type: FieldType.other,
        values: [-1, 1, null],
      },
      {
        type: FieldType.other,
        values: [
          { neg: -100, zero: 0, pos: 1, null: null, array: [0, 1, 2], nested: { number: 1 } },
          { string: 'abcd' },
          {},
        ],
      },
      { type: FieldType.other, values: [[true], [99], ['2021-08-02 00:00:00.000']] },
      { type: FieldType.other, values: [null, null, null] },
      {
        type: FieldType.other,
        values: [
          { neg: -100, zero: 0, pos: 1, null: null, array: [0, 1, 2], nested: { number: 1 } },
          ['a string', 1234, { 'a complex': 'object' }],
          null,
        ],
      },
    ]);
  });

  it('will convert field to strings', () => {
    const options = {
      conversions: [{ targetField: 'numbers', destinationType: FieldType.string }],
    };

    const comboTypes = toDataFrame({
      fields: [
        { name: 'numbers', type: FieldType.number, values: [-100, 0, 1, null, NaN] },
        {
          name: 'strings',
          type: FieldType.string,
          values: ['true', 'false', '0', '99', '2021-08-02 00:00:00.000'],
        },
      ],
    });

    const stringified = convertFieldTypes(options, [comboTypes]);
    expect(
      stringified[0].fields.map((f) => ({
        type: f.type,
        values: f.values.toArray(),
      }))
    ).toEqual([
      {
        type: FieldType.string,
        values: ['-100', '0', '1', 'null', 'NaN'],
      },
      {
        type: FieldType.string,
        values: ['true', 'false', '0', '99', '2021-08-02 00:00:00.000'],
      },
    ]);
  });

  it('will convert time fields to strings', () => {
    const options = {
      conversions: [{ targetField: 'time', destinationType: FieldType.string, dateFormat: 'YYYY-MM' }],
    };

    const stringified = convertFieldTypes(options, [
      toDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [1626674400000, 1627020000000, 1627192800000, 1627797600000, 1627884000000],
          },
        ],
      }),
    ])[0].fields[0];
    expect(stringified.values.toArray()).toEqual([
      '2021-07',
      '2021-07',
      '2021-07', // can group by month
      '2021-08',
      '2021-08',
    ]);
  });
});

describe('ensureTimeField', () => {
  it('will make the field have a type of time if already a number', () => {
    const stringTime = toDataFrame({
      fields: [
        {
          name: 'proper dates',
          type: FieldType.number,
          values: [1626674400000, 1627020000000, 1627192800000, 1627797600000, 1627884000000],
        },
        { name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
      ],
    });

    expect(ensureTimeField(stringTime.fields[0])).toEqual({
      config: {},
      name: 'proper dates',
      type: FieldType.time,
      values: [1626674400000, 1627020000000, 1627192800000, 1627797600000, 1627884000000],
    });
  });
});

describe('fieldToTimeField', () => {
  // this needs to run in a non-UTC timezone env to ensure the parsing is not dependent on env tz settings
  //process.env.TZ = 'Pacific/Easter';

  it('should properly parse ISO 8601 date strings in UTC offset timezone', () => {
    const stringTimeField: Field = {
      config: {},
      name: 'ISO 8601 date strings',
      type: FieldType.time,
      values: ['2021-11-11T19:45:00Z'],
    };

    expect(fieldToTimeField(stringTimeField)).toEqual({
      config: {},
      name: 'ISO 8601 date strings',
      type: FieldType.time,
      values: [1636659900000],
    });
  });

  it('should properly parse additional ISO 8601 date strings with tz offsets and millis', () => {
    const stringTimeField: Field = {
      config: {},
      name: 'ISO 8601 date strings',
      type: FieldType.time,
      values: [
        '2021-11-11T19:45:00+05:30',
        '2021-11-11T19:45:00-05:30',
        '2021-11-11T19:45:00+0530',
        '2021-11-11T19:45:00-0530',
        '2021-11-11T19:45:00.0000000000+05:30',
        '2021-11-11T19:45:00.0000000000-0530',
        '2021-11-11T19:45:00.000Z',
        '2021-11-11T19:45:00.0000000000Z',
      ],
    };

    expect(fieldToTimeField(stringTimeField)).toEqual({
      config: {},
      name: 'ISO 8601 date strings',
      type: FieldType.time,
      values: [
        1636640100000, 1636679700000, 1636640100000, 1636679700000, 1636640100000, 1636679700000, 1636659900000,
        1636659900000,
      ],
    });
  });
});
