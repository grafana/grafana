import { toDataFrame } from '../../dataframe/processDataFrame';
import { Field, FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

import { createTimeFormatter, formatTimeTransformer } from './formatTime';

describe('Format Time Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([formatTimeTransformer]);
  });

  it('will convert time to formatted string', () => {
    const options = {
      timeField: 'time',
      outputFormat: 'YYYY-MM',
    };

    const formatter = createTimeFormatter(options.timeField, options.outputFormat);
    const frame = toDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1612939600000, 1689192000000, 1682025600000, 1690328089000, 1691011200000],
        },
      ],
    });

    const newFrame = formatter(frame.fields, [frame], frame);
    expect(newFrame[0].values).toEqual(['2021-02', '2023-07', '2023-04', '2023-07', '2023-08']);
  });

  it('will handle formats with times', () => {
    const options = {
      timeField: 'time',
      outputFormat: 'YYYY-MM h:mm:ss a',
    };

    const formatter = createTimeFormatter(options.timeField, options.outputFormat);
    const frame = toDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1612939600000, 1689192000000, 1682025600000, 1690328089000, 1691011200000],
        },
      ],
    });

    const newFrame = formatter(frame.fields, [frame], frame);
    expect(newFrame[0].values).toEqual([
      '2021-02 1:46:40 am',
      '2023-07 2:00:00 pm',
      '2023-04 3:20:00 pm',
      '2023-07 5:34:49 pm',
      '2023-08 3:20:00 pm',
    ]);
  });

  it('will handle null times', () => {
    const options = {
      timeField: 'time',
      outputFormat: 'YYYY-MM h:mm:ss a',
    };

    const formatter = createTimeFormatter(options.timeField, options.outputFormat);
    const frame = toDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1612939600000, 1689192000000, 1682025600000, 1690328089000, null],
        },
      ],
    });

    const newFrame = formatter(frame.fields, [frame], frame);
    expect(newFrame[0].values).toEqual([
      '2021-02 1:46:40 am',
      '2023-07 2:00:00 pm',
      '2023-04 3:20:00 pm',
      '2023-07 5:34:49 pm',
      'Invalid date',
    ]);
  });
});

describe('field convert types transformer', () => {
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
        values: f.values,
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
        values: f.values,
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
        values: f.values,
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
});
