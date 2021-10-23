import { ArrayVector, createTheme, FieldType, ThresholdsMode, toDataFrame } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { findNextStateIndex, getThresholdItems, prepareTimelineFields, prepareTimelineLegendItems } from './utils';

const theme = createTheme();

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
    const info = prepareTimelineFields(frames, true, theme);
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
    const info = prepareTimelineFields(frames, true, theme);
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
    const info = prepareTimelineFields(frames, true, theme);
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

describe('findNextStateIndex', () => {
  it('handles leading datapoint index', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: new ArrayVector([1, undefined, undefined, 2, undefined, undefined]),
    } as any;
    const result = findNextStateIndex(field, 0);
    expect(result).toEqual(3);
  });

  it('handles trailing datapoint index', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: new ArrayVector([1, undefined, undefined, 2, undefined, 3]),
    } as any;
    const result = findNextStateIndex(field, 5);
    expect(result).toEqual(null);
  });

  it('handles trailing undefined', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: new ArrayVector([1, undefined, undefined, 2, undefined, 3, undefined]),
    } as any;
    const result = findNextStateIndex(field, 5);
    expect(result).toEqual(null);
  });

  it('handles datapoint index inside range', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: new ArrayVector([
        1,
        undefined,
        undefined,
        3,
        undefined,
        undefined,
        undefined,
        undefined,
        2,
        undefined,
        undefined,
      ]),
    } as any;
    const result = findNextStateIndex(field, 3);
    expect(result).toEqual(8);
  });

  describe('single data points', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: new ArrayVector([1, 3, 2]),
    } as any;

    test('leading', () => {
      const result = findNextStateIndex(field, 0);
      expect(result).toEqual(1);
    });
    test('trailing', () => {
      const result = findNextStateIndex(field, 2);
      expect(result).toEqual(null);
    });

    test('inside', () => {
      const result = findNextStateIndex(field, 1);
      expect(result).toEqual(2);
    });
  });
});

describe('getThresholdItems', () => {
  it('should handle only one threshold', () => {
    const result = getThresholdItems(
      { thresholds: { mode: ThresholdsMode.Absolute, steps: [{ color: 'black', value: 0 }] } },
      theme
    );

    expect(result).toHaveLength(1);
  });
});

describe('prepareTimelineLegendItems', () => {
  it('should return legend items', () => {
    const frame: any = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            config: {
              color: {
                mode: 'thresholds',
              },
              thresholds: {
                mode: 'absolute',
                steps: [
                  {
                    color: 'green',
                    value: null,
                  },
                ],
              },
            },
            values: new ArrayVector([
              1634092733455,
              1634092763455,
              1634092793455,
              1634092823455,
              1634092853455,
              1634092883455,
              1634092913455,
              1634092943455,
              1634092973455,
              1634093003455,
            ]),
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'A-series',
            config: {
              color: {
                mode: 'thresholds',
              },
              thresholds: {
                mode: 'absolute',
                steps: [
                  {
                    color: 'green',
                    value: null,
                  },
                ],
              },
            },
            values: new ArrayVector(['< -∞', null, null, null, null, null, null, null, null, null]),
            display: (value?: string) => ({
              text: value || '',
              color: 'green',
              numeric: NaN,
            }),
          },
        ],
      },
    ];

    const result = prepareTimelineLegendItems(frame, { displayMode: LegendDisplayMode.List } as any, theme);

    expect(result).toHaveLength(1);
  });
});
