import { createTheme, FieldType, MutableDataFrame, toDataFrame } from '@grafana/data';

import { prepareGraphableFields } from './utils';

describe('prepare timeseries graph', () => {
  it('errors with no time fields', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'a', values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const frames = prepareGraphableFields(input, createTheme());
    expect(frames).toBeNull();
  });

  it('requires a number or boolean value', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const frames = prepareGraphableFields(input, createTheme());
    expect(frames).toBeNull();
  });

  it('will graph numbers and boolean values', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
          { name: 'c', values: [true, false, true] },
          { name: 'd', values: [100, 200, 300] },
        ],
      }),
    ];
    const frames = prepareGraphableFields(input, createTheme());
    const out = frames![0];

    expect(out.fields.map((f) => f.name)).toEqual(['a', 'b', 'c', 'd']);

    const field = out.fields.find((f) => f.name === 'c');
    expect(field?.display).toBeDefined();
    expect(field!.display!(1)).toMatchInlineSnapshot(`
      Object {
        "color": "#808080",
        "numeric": 1,
        "percent": 1,
        "prefix": undefined,
        "suffix": undefined,
        "text": "True",
      }
    `);
  });

  it('will convert NaN and Infinty to nulls', () => {
    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [995, 9996, 9997, 9998, 9999] },
        { name: 'a', values: [-10, NaN, 10, -Infinity, +Infinity] },
      ],
    });
    const frames = prepareGraphableFields([df], createTheme());

    const field = frames![0].fields.find((f) => f.name === 'a');
    expect(field!.values.toArray()).toMatchInlineSnapshot(`
      Array [
        -10,
        null,
        10,
        null,
        null,
      ]
    `);
  });

  it('will insert nulls given an interval value', () => {
    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 6] },
        { name: 'a', values: [1, 2, 3] },
      ],
    });
    const frames = prepareGraphableFields([df], createTheme());

    const field = frames![0].fields.find((f) => f.name === 'a');
    expect(field!.values.toArray()).toMatchInlineSnapshot(`
      Array [
        1,
        null,
        2,
        null,
        null,
        3,
      ]
    `);

    expect(frames![0].length).toEqual(6);
  });

  it('will insert and convert nulls to a configure "no value" value', () => {
    const df = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 6] },
        { name: 'a', config: { noValue: '20' }, values: [1, 2, 3] },
      ],
    });
    const frames = prepareGraphableFields([df], createTheme());

    const field = frames![0].fields.find((f) => f.name === 'a');
    expect(field!.values.toArray()).toMatchInlineSnapshot(`
      Array [
        1,
        20,
        2,
        20,
        20,
        3,
      ]
    `);
    expect(frames![0].length).toEqual(6);
  });
});
