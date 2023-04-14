import { createTheme, FieldType, ThresholdsMode, TimeRange, toDataFrame, dateTime, DataFrame } from '@grafana/data';
import { LegendDisplayMode, VizLegendOptions } from '@grafana/schema';

import {
  findNextStateIndex,
  fmtDuration,
  getThresholdItems,
  prepareTimelineFields,
  prepareTimelineLegendItems,
} from './utils';

const theme = createTheme();

describe('prepare timeline graph', () => {
  const timeRange: TimeRange = {
    from: dateTime(1),
    to: dateTime(3),
    raw: {
      from: dateTime(1),
      to: dateTime(3),
    },
  };
  it('errors with no time fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', values: [1, 2, 3] },
          { name: 'b', values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const info = prepareTimelineFields(frames, true, timeRange, theme);
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
    const info = prepareTimelineFields(frames, true, timeRange, theme);
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
    const info = prepareTimelineFields(frames, true, timeRange, theme);
    expect(info.warn).toBeUndefined();

    const out = info.frames![0];

    const field = out.fields.find((f) => f.name === 'b');
    expect(field?.values.toArray()).toMatchInlineSnapshot(`
      [
        1,
        1,
        undefined,
        1,
        2,
        2,
        null,
        2,
        3,
      ]
    `);
  });
  it('should try to sort time fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [4, 3, 1, 2] },
          { name: 'b', values: [1, 1, 2, 2] },
        ],
      }),
    ];
    const result = prepareTimelineFields(frames, true, timeRange, theme);
    expect(result.frames?.[0].fields[0].values.toArray()).toEqual([1, 2, 3, 4]);
  });
});

describe('findNextStateIndex', () => {
  it('handles leading datapoint index', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: [1, undefined, undefined, 2, undefined, undefined],
      config: {},
    };
    const result = findNextStateIndex(field, 0);
    expect(result).toEqual(3);
  });

  it('handles trailing datapoint index', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: [1, undefined, undefined, 2, undefined, 3],
      config: {},
    };
    const result = findNextStateIndex(field, 5);
    expect(result).toEqual(null);
  });

  it('handles trailing undefined', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: [1, undefined, undefined, 2, undefined, 3, undefined],
      config: {},
    };
    const result = findNextStateIndex(field, 5);
    expect(result).toEqual(null);
  });

  it('handles datapoint index inside range', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: [1, undefined, undefined, 3, undefined, undefined, undefined, undefined, 2, undefined, undefined],
      config: {},
    };
    const result = findNextStateIndex(field, 3);
    expect(result).toEqual(8);
  });

  describe('single data points', () => {
    const field = {
      name: 'time',
      type: FieldType.number,
      values: [1, 3, 2],
      config: {},
    };

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
  it('should return legend items without crashing when single (base) threshold', () => {
    const frames = [
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
            values: [
              1634092733455, 1634092763455, 1634092793455, 1634092823455, 1634092853455, 1634092883455, 1634092913455,
              1634092943455, 1634092973455, 1634093003455,
            ],
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
            values: ['< -∞', null, null, null, null, null, null, null, null, null],
            display: (value?: string) => ({
              text: value || '',
              color: 'green',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const result = prepareTimelineLegendItems(
      frames,
      { displayMode: LegendDisplayMode.List } as VizLegendOptions,
      theme
    );

    expect(result).toHaveLength(1);
  });
});

describe('duration', () => {
  it.each`
    value               | expected
    ${-1}               | ${''}
    ${20}               | ${'20ms'}
    ${1000}             | ${'1s'}
    ${1020}             | ${'1s 20ms'}
    ${60000}            | ${'1m'}
    ${61020}            | ${'1m 1s'}
    ${3600000}          | ${'1h'}
    ${6600000}          | ${'1h 50m'}
    ${86400000}         | ${'1d'}
    ${96640000}         | ${'1d 2h'}
    ${604800000}        | ${'1w'}
    ${691200000}        | ${'1w 1d'}
    ${2419200000}       | ${'4w'}
    ${2678400000}       | ${'1mo 1d'}
    ${3196800000}       | ${'1mo 1w'}
    ${3456000000}       | ${'1mo 1w 3d'}
    ${6739200000}       | ${'2mo 2w 4d'}
    ${31536000000}      | ${'1y'}
    ${31968000000}      | ${'1y 5d'}
    ${32140800000}      | ${'1y 1w'}
    ${67910400000}      | ${'2y 1mo 3w 5d'}
    ${40420800000}      | ${'1y 3mo 1w 5d'}
    ${9007199254740991} | ${'285616y 5mo 1d'}
  `(' function should format $value ms to $expected', ({ value, expected }) => {
    const result = fmtDuration(value);
    expect(result).toEqual(expected);
  });
});
