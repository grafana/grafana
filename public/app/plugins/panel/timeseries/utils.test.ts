import { createTheme, FieldType, MutableDataFrame, toDataFrame } from '@grafana/data';
import { prepareGraphableFields } from './utils';

describe('prepare timeseries graph', () => {
  it('errors with no time fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const info = prepareGraphableFields(frames, createTheme());
    expect(info.warn).toEqual('Data does not have a time field');
  });

  it('requires a number or boolean value', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const info = prepareGraphableFields(frames, createTheme());
    expect(info.warn).toEqual('No graphable fields');
  });

  it('will graph numbers and boolean values', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
          { name: 'c', values: [true, false, true] },
          { name: 'd', values: [100, 200, 300] },
        ],
      }),
    ];
    const info = prepareGraphableFields(frames, createTheme());
    expect(info.warn).toBeUndefined();

    const out = info.frames![0];
    expect(out.fields.map((f) => f.name)).toEqual(['a', 'c', 'd']);

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
    const result = prepareGraphableFields([df], createTheme());

    const field = result.frames![0].fields.find((f) => f.name === 'a');
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
});
