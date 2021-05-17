import { FieldType, toDataFrame } from '@grafana/data';
import { prepareTimelineFields } from './utils';

describe('prepare timeline graph', () => {
  it('errors with no time fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const info = prepareTimelineFields(frames, true);
    expect(info.warn).toEqual('Data does not have a time field');
  });

  it('requires a number, string, or boolean value', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', type: FieldType.other, values: [{}, {}, {}] },
        ],
      }),
    ];
    const info = prepareTimelineFields(frames, true);
    expect(info.warn).toEqual('No graphable fields');
  });

  it('will merge duplicate values', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3, 4, 5, 6, 7] },
          { name: 'b', values: [1, 1, undefined, 1, 2, 2, null, 2, 3] },
        ],
      }),
    ];
    const info = prepareTimelineFields(frames, true);
    expect(info.warn).toBeUndefined();

    const out = info.frames![0];

    const field = out.fields.find((f) => f.name === 'b');
    expect(field?.values.toArray()).toMatchInlineSnapshot(`
      Array [
        1,
        undefined,
        undefined,
        undefined,
        2,
        undefined,
        null,
        2,
        3,
      ]
    `);
  });
});
