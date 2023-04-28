import { DataFrame } from '../types';

import { ArrayDataFrame, arrayToDataFrame } from './ArrayDataFrame';
import { toDataFrameDTO } from './processDataFrame';

describe('Array DataFrame', () => {
  const input = [
    { name: 'first', value: 1, time: 123 },
    { name: 'second', value: 2, time: 456, extra: 'here' },
    { name: 'third', value: 3, time: 789 },
    { name: '4th (NaN)', value: NaN, time: 1000 },
    { name: '5th (Null)', value: null, time: 1100 },
  ];

  const frame = new ArrayDataFrame(input);
  frame.name = 'Hello';
  frame.refId = 'Z';
  const field = frame.fields.find((f) => f.name === 'value');
  field!.config.unit = 'kwh';

  test('Should convert an array of objects to a dataframe', () => {
    expect(toDataFrameDTO(frame)).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "config": {},
            "labels": undefined,
            "name": "name",
            "type": "string",
            "values": [
              "first",
              "second",
              "third",
              "4th (NaN)",
              "5th (Null)",
            ],
          },
          {
            "config": {
              "unit": "kwh",
            },
            "labels": undefined,
            "name": "value",
            "type": "number",
            "values": [
              1,
              2,
              3,
              NaN,
              null,
            ],
          },
          {
            "config": {},
            "labels": undefined,
            "name": "time",
            "type": "time",
            "values": [
              123,
              456,
              789,
              1000,
              1100,
            ],
          },
        ],
        "meta": undefined,
        "name": "Hello",
        "refId": "Z",
      }
    `);
  });

  test('Survives ES6 operations', () => {
    const copy: DataFrame = {
      ...frame,
      name: 'hello',
    };
    expect(copy.fields).toEqual(frame.fields);
    expect(copy.length).toEqual(frame.length);
    expect(copy.length).toEqual(input.length);
  });

  test('Handles any array input', () => {
    const f = arrayToDataFrame([1, 2, 3]);
    expect(f).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "config": {},
            "name": "Value",
            "type": "number",
            "values": [
              1,
              2,
              3,
            ],
          },
        ],
        "length": 3,
      }
    `);
  });
});
