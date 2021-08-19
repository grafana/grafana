import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { fieldConversion, fieldConversionTransformer } from './fieldConversion';

describe('field conversion transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([fieldConversionTransformer]);
  });

  it('will parse properly formatted strings to time', () => {
    const options = {
      conversions: [{ targetField: 'proper dates', destinationType: FieldType.time }],
    };

    const stringTime = toDataFrame({
      fields: [
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
        { name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
      ],
    });

    const timeified = fieldConversion(options, [stringTime]);
    expect(
      timeified[0].fields.map((f) => ({
        name: f.name,
        type: f.type,
        values: f.values.toArray(),
        config: f.config,
      }))
    ).toEqual([
      {
        config: {},
        name: 'proper dates',
        type: FieldType.time,
        values: [1626674400000, 1627020000000, 1627192800000, 1627797600000, 1627884000000],
      },
      { config: {}, name: 'A', type: 'number', values: [1, 2, 3, 4, 5] },
    ]);
  });

  it('will parse string time to specified format in time', () => {
    const options = {
      conversions: [{ targetField: 'format to year', destinationType: FieldType.time, dateFormat: 'YYYY' }],
    };

    const yearFormat = toDataFrame({
      fields: [
        { name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
        {
          name: 'format to year',
          type: FieldType.string,
          values: [
            '2017-07-19 00:00:00.000',
            '2018-07-23 00:00:00.000',
            '2019-07-25 00:00:00.000',
            '2020-08-01 00:00:00.000',
            '2021-08-02 00:00:00.000',
          ],
        },
      ],
    });

    const timeified = fieldConversion(options, [yearFormat]);
    expect(
      timeified[0].fields.map((f) => ({
        name: f.name,
        type: f.type,
        values: f.values.toArray(),
        config: f.config,
      }))
    ).toEqual([
      { config: {}, name: 'A', type: 'number', values: [1, 2, 3, 4, 5] },
      {
        config: {},
        name: 'format to year',
        type: FieldType.time,
        values: [1483246800000, 1514782800000, 1546318800000, 1577854800000, 1609477200000],
      },
    ]);
  });

  it('will not parse improperly formatted date strings', () => {
    const options = {
      conversions: [{ targetField: 'misformatted dates', destinationType: FieldType.time }],
    };

    const misformattedStrings = toDataFrame({
      fields: [
        {
          name: 'misformatted dates',
          type: FieldType.string,
          values: ['2021/08-01 00:00.00:000', '2021/08/01 00.00-000', '2021/08-01 00:00.00:000'],
          config: { unit: 'time' },
        },
        { name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
      ],
    });

    const timeified = fieldConversion(options, [misformattedStrings]);
    expect(
      timeified[0].fields.map((f) => ({
        name: f.name,
        type: f.type,
        values: f.values.toArray(),
        config: f.config,
      }))
    ).toEqual([
      {
        name: 'misformatted dates',
        type: FieldType.time,
        values: [undefined, undefined, undefined, undefined, undefined],
        config: { unit: 'time' },
      },
      { config: {}, name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
    ]);
  });

  it('can convert strings to numbers', () => {
    const options = {
      conversions: [{ targetField: 'stringy nums', destinationType: FieldType.number }],
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

    const numbers = fieldConversion(options, [stringyNumbers]);

    expect(
      numbers[0].fields.map((f) => ({
        name: f.name,
        type: f.type,
        values: f.values.toArray(),
        config: f.config,
      }))
    ).toEqual([
      { config: {}, name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
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
        config: {},
      },
      {
        name: 'stringy nums',
        type: FieldType.number,
        values: [10, 12, 30, 14, 10],
        config: {},
      },
    ]);
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

    const numbers = fieldConversion(options, [stringyNumbers]);
    expect(
      numbers[0].fields.map((f) => ({
        name: f.name,
        type: f.type,
        values: f.values.toArray(),
        config: f.config,
      }))
    ).toEqual([
      { config: {}, name: 'A', type: FieldType.number, values: [1, 2, 3, 4, 5] },
      {
        config: {},
        name: 'proper dates',
        type: FieldType.time,
        values: [1626674400000, 1627020000000, 1627192800000, 1627797600000, 1627884000000],
      },
      {
        name: 'stringy nums',
        type: FieldType.number,
        values: [10, 12, 30, 14, 10],
        config: {},
      },
    ]);
  });

  it('will convert to boolean', () => {
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

    const booleans = fieldConversion(options, [comboTypes]);
    expect(
      booleans[0].fields.map((f) => ({
        name: f.name,
        type: f.type,
        values: f.values.toArray(),
        config: f.config,
      }))
    ).toEqual([
      {
        config: {},
        name: 'numbers',
        type: FieldType.boolean,
        values: [true, false, true, false, false],
      },
      { config: {}, name: 'strings', type: FieldType.boolean, values: [true, true, true, true, true] },
    ]);
  });

  it('will convert to strings', () => {
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

    const stringified = fieldConversion(options, [comboTypes]);
    expect(
      stringified[0].fields.map((f) => ({
        name: f.name,
        type: f.type,
        values: f.values.toArray(),
        config: f.config,
      }))
    ).toEqual([
      {
        config: {},
        name: 'numbers',
        type: FieldType.string,
        values: ['-100', '0', '1', 'null', 'NaN'],
      },
      {
        config: {},
        name: 'strings',
        type: FieldType.string,
        values: ['true', 'false', '0', '99', '2021-08-02 00:00:00.000'],
      },
    ]);
  });

  //test ensureTime
});
