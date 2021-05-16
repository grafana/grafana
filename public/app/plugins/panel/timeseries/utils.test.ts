import { createTheme, FieldType, toDataFrame } from '@grafana/data';
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
    expect(info.frames![0].fields.map((f) => f.name)).toEqual(['a', 'c', 'd']);

    const field = frames[0].fields.find((f) => f.name === 'c');
    expect(field?.display).toBeDefined();
    expect(field!.display!(1)).toMatchInlineSnapshot();
  });
});
