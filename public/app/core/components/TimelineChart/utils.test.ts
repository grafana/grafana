import {
  createTheme,
  FieldType,
  ThresholdsMode,
  TimeRange,
  toDataFrame,
  dateTime,
  DataFrame,
  fieldMatchers,
  FieldMatcherID,
  Field,
  SpecialValueMatch,
} from '@grafana/data';
import { LegendDisplayMode, MappingType, VizLegendOptions } from '@grafana/schema';

import { preparePlotFrame } from '../GraphNG/utils';

import {
  findNextStateIndex,
  fmtDuration,
  getThresholdItems,
  hasSpecialMappedValue,
  makeFramePerSeries,
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

  it('errors with no frame', () => {
    const info = prepareTimelineFields(undefined, true, timeRange, theme);
    expect(info.frames).toBeUndefined();
    expect(info.warn).toBe('');
  });

  it('errors with empty frame', () => {
    const info = prepareTimelineFields([], true, timeRange, theme);
    expect(info.frames).toBeUndefined();
    expect(info.warn).toBe('');
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
    expect(field?.values).toMatchInlineSnapshot(`
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
    expect(result.frames?.[0].fields[0].values).toEqual([1, 2, 3, 4]);
  });

  it('join multiple frames with NULL_RETAIN rather than NULL_EXPAND', () => {
    const timeRange2: TimeRange = {
      from: dateTime('2023-10-20T05:04:00.000Z'),
      to: dateTime('2023-10-20T07:22:00.000Z'),
      raw: {
        from: dateTime('2023-10-20T05:04:00.000Z'),
        to: dateTime('2023-10-20T07:22:00.000Z'),
      },
    };

    const frames = [
      toDataFrame({
        name: 'Mix',
        fields: [
          { name: 'time', type: FieldType.time, values: [1697778291972, 1697778393992, 1697778986994, 1697786485890] },
          { name: 'state', type: FieldType.string, values: ['RUN', null, 'RUN', null] },
        ],
      }),
      toDataFrame({
        name: 'Cook',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1697779163986, 1697779921045, 1697780221094, 1697780521111, 1697781186192, 1697781786291, 1697783332361,
              1697783784395, 1697783790397, 1697784146478, 1697784517471, 1697784523487, 1697784949480, 1697785369505,
            ],
          },
          {
            name: 'state',
            type: FieldType.string,
            values: [
              'Heat',
              'Stage',
              null,
              'Heat',
              'Stage',
              null,
              'Heat',
              'Stage',
              null,
              'Heat',
              'Stage',
              null,
              'CCP',
              null,
            ],
          },
        ],
      }),
    ];

    const info = prepareTimelineFields(frames, true, timeRange2, theme);

    let joined = preparePlotFrame(
      info.frames!,
      {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.byType).get('string'),
      },
      timeRange2
    );

    let vals = joined!.fields.map((f) => f.values);

    expect(vals).toEqual([
      [
        1697778291972, 1697778393992, 1697778986994, 1697779163986, 1697779921045, 1697780221094, 1697780521111,
        1697781186192, 1697781786291, 1697783332361, 1697783784395, 1697783790397, 1697784146478, 1697784517471,
        1697784523487, 1697784949480, 1697785369505, 1697786485890,
      ],
      [
        'RUN',
        null,
        'RUN',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        null,
      ],
      [
        undefined,
        undefined,
        undefined,
        'Heat',
        'Stage',
        null,
        'Heat',
        'Stage',
        null,
        'Heat',
        'Stage',
        null,
        'Heat',
        'Stage',
        null,
        'CCP',
        null,
        undefined,
      ],
    ]);
  });

  it('join multiple frames with start and end time fields', () => {
    const timeRange2: TimeRange = {
      from: dateTime('2024-02-28T07:47:21.428Z'),
      to: dateTime('2024-02-28T14:12:43.391Z'),
      raw: {
        from: dateTime('2024-02-28T07:47:21.428Z'),
        to: dateTime('2024-02-28T14:12:43.391Z'),
      },
    };

    const frames = [
      toDataFrame({
        name: 'Channel 1',
        fields: [
          { name: 'starttime', type: FieldType.time, values: [1709107200000, 1709118000000] },
          { name: 'endtime', type: FieldType.time, values: [1709114400000, 1709128800000] },
          { name: 'state', type: FieldType.string, values: ['OK', 'NO_DATA'] },
        ],
      }),
      toDataFrame({
        name: 'Channel 2',
        fields: [
          { name: 'starttime', type: FieldType.time, values: [1709110800000, 1709123400000] },
          { name: 'endtime', type: FieldType.time, values: [1709116200000, 1709127000000] },
          { name: 'state', type: FieldType.string, values: ['ERROR', 'WARNING'] },
        ],
      }),
    ];

    const info = prepareTimelineFields(frames, true, timeRange2, theme);

    let joined = preparePlotFrame(
      info.frames!,
      {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.byType).get('string'),
      },
      timeRange2
    );

    let vals = joined!.fields.map((f) => f.values);

    expect(vals).toEqual([
      [
        1709107200000, 1709110800000, 1709114400000, 1709116200000, 1709118000000, 1709123400000, 1709127000000,
        1709128800000,
      ],
      ['OK', undefined, null, undefined, 'NO_DATA', undefined, undefined, null],
      [undefined, 'ERROR', undefined, null, undefined, 'WARNING', null, undefined],
    ]);
  });
});

describe('prepareFieldsForPagination', () => {
  it('ignores frames without any time fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.number, values: [1, 2, 3] },
          { name: 'b', type: FieldType.string, values: ['a', 'b', 'c'] },
        ],
      }),
    ];
    const normalizedFrames = makeFramePerSeries(frames);
    expect(normalizedFrames.length).toEqual(0);
  });

  it('returns normalized frames, each with one time field and one value field', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3] },
          { name: 'b', type: FieldType.number, values: [100, 200, 300] },
          { name: 'c', type: FieldType.string, values: ['h', 'i', 'j'] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'x', type: FieldType.time, values: [10, 20, 30] },
          { name: 'y', type: FieldType.string, values: ['e', 'f', 'g'] },
        ],
      }),
    ];
    const normalizedFrames = makeFramePerSeries(frames);
    expect(normalizedFrames.length).toEqual(3);
    expect(normalizedFrames).toMatchObject([
      {
        fields: [
          { name: 'a', values: [1, 2, 3] },
          { name: 'b', values: [100, 200, 300] },
        ],
      },
      {
        fields: [
          { name: 'a', values: [1, 2, 3] },
          { name: 'c', values: ['h', 'i', 'j'] },
        ],
      },
      {
        fields: [
          { name: 'x', values: [10, 20, 30] },
          { name: 'y', values: ['e', 'f', 'g'] },
        ],
      },
    ]);
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

  it('should format legend items correctly with no legend values in list mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const resultNone = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.List,
        values: [],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItemNone = resultNone!.find((item) => item.label.includes('Low'))!;
    const mediumItemNone = resultNone!.find((item) => item.label.includes('Medium'))!;
    const highItemNone = resultNone!.find((item) => item.label.includes('High'))!;

    expect(resultNone).toBeDefined();
    expect(resultNone!.length).toBe(3);
    expect(lowItemNone.label).toBe('Low');
    expect(mediumItemNone.label).toBe('Medium');
    expect(highItemNone.label).toBe('High');
  });
  it('should format legend items correctly with all legend values in list mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const result = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.List,
        values: ['duration', 'percentage', 'occurrences'],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItem = result!.find((item) => item.label.includes('Low'))!;
    const mediumItem = result!.find((item) => item.label.includes('Medium'))!;
    const highItem = result!.find((item) => item.label.includes('High'))!;

    expect(result).toBeDefined();
    expect(result!.length).toBe(3);
    expect(lowItem.label).toBe('Low (1h 45m, 58.33%, 3 times)');
    expect(mediumItem.label).toBe('Medium (30m, 16.67%, 1 time)');
    expect(highItem.label).toBe('High (45m, 25.00%, 2 times)');
  });
  it('should format legend items correctly with only duration values in list mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const resultDuration = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.List,
        values: ['duration'],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );
    const lowItemDuration = resultDuration!.find((item) => item.label.includes('Low'))!;
    const mediumItemDuration = resultDuration!.find((item) => item.label.includes('Medium'))!;
    const highItemDuration = resultDuration!.find((item) => item.label.includes('High'))!;

    expect(resultDuration).toBeDefined();
    expect(resultDuration!.length).toBe(3);
    expect(lowItemDuration.label).toBe('Low (1h 45m)');
    expect(mediumItemDuration.label).toBe('Medium (30m)');
    expect(highItemDuration.label).toBe('High (45m)');
  });
  it('should format legend items correctly with only percentage values in list mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const resultPercentage = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.List,
        values: ['percentage'],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItemPercentage = resultPercentage!.find((item) => item.label.includes('Low'))!;
    const mediumItemPercentage = resultPercentage!.find((item) => item.label.includes('Medium'))!;
    const highItemPercentage = resultPercentage!.find((item) => item.label.includes('High'))!;

    expect(resultPercentage).toBeDefined();
    expect(resultPercentage!.length).toBe(3);
    expect(lowItemPercentage.label).toBe('Low (58.33%)');
    expect(mediumItemPercentage.label).toBe('Medium (16.67%)');
    expect(highItemPercentage.label).toBe('High (25.00%)');
  });
  it('should format legend items correctly with only occurrences values in list mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const resultOccurrences = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.List,
        values: ['occurrences'],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItemOccurrences = resultOccurrences!.find((item) => item.label.includes('Low'))!;
    const mediumItemOccurrences = resultOccurrences!.find((item) => item.label.includes('Medium'))!;
    const highItemOccurrences = resultOccurrences!.find((item) => item.label.includes('High'))!;

    expect(resultOccurrences).toBeDefined();
    expect(resultOccurrences!.length).toBe(3);
    expect(lowItemOccurrences.label).toBe('Low (3 times)');
    expect(mediumItemOccurrences.label).toBe('Medium (1 time)');
    expect(highItemOccurrences.label).toBe('High (2 times)');
  });

  it('should format legend items correctly with no legend values in table mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const resultNone = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.Table,
        values: [],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItemNone = resultNone!.find((item) => item.label.includes('Low'))!;
    const mediumItemNone = resultNone!.find((item) => item.label.includes('Medium'))!;
    const highItemNone = resultNone!.find((item) => item.label.includes('High'))!;

    expect(resultNone).toBeDefined();
    expect(resultNone!.length).toBe(3);
    expect(lowItemNone.label).toBe('Low');
    expect(mediumItemNone.label).toBe('Medium');
    expect(highItemNone.label).toBe('High');
    expect(lowItemNone.getDisplayValues?.()).toEqual([]);
    expect(mediumItemNone.getDisplayValues?.()).toEqual([]);
    expect(highItemNone.getDisplayValues?.()).toEqual([]);
  });
  it('should format legend items correctly with all legend values in table mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const result = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.Table,
        values: ['duration', 'percentage', 'occurrences'],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItem = result!.find((item) => item.label === 'Low')!;
    const mediumItem = result!.find((item) => item.label === 'Medium')!;
    const highItem = result!.find((item) => item.label === 'High')!;

    expect(result).toBeDefined();
    expect(result!.length).toBe(3);
    expect(lowItem.label).toBe('Low');
    expect(mediumItem.label).toBe('Medium');
    expect(highItem.label).toBe('High');

    expect(lowItem.getDisplayValues?.()).toEqual([
      { text: '1h 45m', numeric: 6300000, title: 'Duration' },
      { text: '58.33%', numeric: 58.333333333333336, title: 'Percentage' },
      { text: '3', numeric: 3, title: 'Occurrences' },
    ]);
    expect(mediumItem.getDisplayValues?.()).toEqual([
      { text: '30m', numeric: 1800000, title: 'Duration' },
      { text: '16.67%', numeric: 16.666666666666664, title: 'Percentage' },
      { text: '1', numeric: 1, title: 'Occurrences' },
    ]);
    expect(highItem.getDisplayValues?.()).toEqual([
      { text: '45m', numeric: 2700000, title: 'Duration' },
      { text: '25.00%', numeric: 25, title: 'Percentage' },
      { text: '2', numeric: 2, title: 'Occurrences' },
    ]);
  });
  it('should format legend items correctly with duration values in table mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const resultDuration = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.Table,
        values: ['duration'],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItemDuration = resultDuration!.find((item) => item.label === 'Low')!;
    const mediumItemDuration = resultDuration!.find((item) => item.label === 'Medium')!;
    const highItemDuration = resultDuration!.find((item) => item.label === 'High')!;

    expect(resultDuration).toBeDefined();
    expect(resultDuration!.length).toBe(3);
    expect(lowItemDuration.label).toBe('Low');
    expect(mediumItemDuration.label).toBe('Medium');
    expect(highItemDuration.label).toBe('High');

    expect(lowItemDuration.getDisplayValues?.()).toEqual([{ text: '1h 45m', numeric: 6300000, title: 'Duration' }]);
    expect(mediumItemDuration.getDisplayValues?.()).toEqual([{ text: '30m', numeric: 1800000, title: 'Duration' }]);
    expect(highItemDuration.getDisplayValues?.()).toEqual([{ text: '45m', numeric: 2700000, title: 'Duration' }]);
  });
  it('should format legend items correctly with percentage values in table mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const resultPercentage = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.Table,
        values: ['percentage'],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItemPercentage = resultPercentage!.find((item) => item.label === 'Low')!;
    const mediumItemPercentage = resultPercentage!.find((item) => item.label === 'Medium')!;
    const highItemPercentage = resultPercentage!.find((item) => item.label === 'High')!;

    expect(resultPercentage).toBeDefined();
    expect(resultPercentage!.length).toBe(3);
    expect(lowItemPercentage.label).toBe('Low');
    expect(mediumItemPercentage.label).toBe('Medium');
    expect(highItemPercentage.label).toBe('High');

    expect(lowItemPercentage.getDisplayValues?.()).toEqual([
      { text: '58.33%', numeric: 58.333333333333336, title: 'Percentage' },
    ]);
    expect(mediumItemPercentage.getDisplayValues?.()).toEqual([
      { text: '16.67%', numeric: 16.666666666666664, title: 'Percentage' },
    ]);
    expect(highItemPercentage.getDisplayValues?.()).toEqual([{ text: '25.00%', numeric: 25, title: 'Percentage' }]);
  });
  it('should format legend items correctly with occurrences values in table mode', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const frames = [
      {
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [
              1749614400000, 1749615300000, 1749616200000, 1749617100000, 1749618000000, 1749618900000, 1749619800000,
              1749620700000, 1749621600000, 1749622500000, 1749623400000, 1749624300000,
            ],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: undefined,
              numeric: NaN,
            }),
          },
          {
            name: 'state',
            values: ['Low', 'Low', 'Low', 'Low', 'Medium', 'Medium', 'Low', 'Low', 'High', 'High', 'Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : value === 'Medium' ? 'yellow' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const resultOccurrences = prepareTimelineLegendItems(
      frames,
      {
        displayMode: LegendDisplayMode.Table,
        values: ['occurrences'],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    const lowItemOccurrences = resultOccurrences!.find((item) => item.label === 'Low')!;
    const mediumItemOccurrences = resultOccurrences!.find((item) => item.label === 'Medium')!;
    const highItemOccurrences = resultOccurrences!.find((item) => item.label === 'High')!;

    expect(resultOccurrences).toBeDefined();
    expect(resultOccurrences!.length).toBe(3);
    expect(lowItemOccurrences.label).toBe('Low');
    expect(mediumItemOccurrences.label).toBe('Medium');
    expect(highItemOccurrences.label).toBe('High');

    expect(lowItemOccurrences.getDisplayValues?.()).toEqual([{ text: '3', numeric: 3, title: 'Occurrences' }]);
    expect(mediumItemOccurrences.getDisplayValues?.()).toEqual([{ text: '1', numeric: 1, title: 'Occurrences' }]);
    expect(highItemOccurrences.getDisplayValues?.()).toEqual([{ text: '2', numeric: 2, title: 'Occurrences' }]);
  });

  it('should format legend labels correctly for multiple series', () => {
    const timeRange: TimeRange = {
      from: dateTime(1749614400000),
      to: dateTime(1749625200000),
      raw: {
        from: dateTime(1749614400000),
        to: dateTime(1749625200000),
      },
    };

    const multipleSeriesFrames = [
      {
        refId: 'A',
        name: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [1749614400000, 1749615300000],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
          },
          {
            name: 'Service A',
            values: ['Low', 'High'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Low' ? 'green' : 'red',
              numeric: NaN,
            }),
          },
        ],
      },
      {
        refId: 'B',
        name: 'B',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [1749614400000, 1749615300000],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
          },
          {
            name: 'Service B',
            values: ['Up', 'Down'],
            config: {
              custom: {
                hideFrom: {
                  legend: false,
                },
              },
            },
            display: (value: string) => ({
              text: value,
              color: value === 'Up' ? 'blue' : 'orange',
              numeric: NaN,
            }),
          },
        ],
      },
    ] as unknown as DataFrame[];

    const multipleSeriesResult = prepareTimelineLegendItems(
      multipleSeriesFrames,
      {
        displayMode: LegendDisplayMode.List,
        values: [],
        calcs: [],
        placement: 'bottom',
        showLegend: true,
      } as VizLegendOptions,
      theme,
      timeRange
    );

    expect(multipleSeriesResult).toBeDefined();
    expect(multipleSeriesResult!.length).toBe(4);

    const lowItem = multipleSeriesResult!.find((item) => item.label === 'Service A: Low')!;
    const upItem = multipleSeriesResult!.find((item) => item.label === 'Service B: Up')!;
    const highItem = multipleSeriesResult!.find((item) => item.label === 'Service A: High')!;
    const downItem = multipleSeriesResult!.find((item) => item.label === 'Service B: Down')!;

    expect(lowItem).toBeDefined();
    expect(upItem).toBeDefined();
    expect(highItem).toBeDefined();
    expect(downItem).toBeDefined();
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

describe('hasSpecialMappedValue', () => {
  const makeField = (mappingsType: MappingType | SpecialValueMatch, optionsMatch: MappingType | SpecialValueMatch) =>
    ({
      name: 'Field',
      type: FieldType.frame,
      config: {
        mappings: [
          {
            type: mappingsType,
            options: { match: optionsMatch, result: {} },
          },
        ],
      },
      values: [],
    }) as Field;

  it.each([
    [[MappingType.SpecialValue, SpecialValueMatch.Null], SpecialValueMatch.Null, true, 'should match Null with Null'],
    [[MappingType.SpecialValue, SpecialValueMatch.NaN], SpecialValueMatch.NaN, true, 'should match NaN with NaN'],
    [
      [MappingType.SpecialValue, SpecialValueMatch.NullAndNaN],
      SpecialValueMatch.NullAndNaN,
      true,
      'should match Null and NaN with Null and NaN',
    ],
    [
      [MappingType.SpecialValue, SpecialValueMatch.NullAndNaN],
      SpecialValueMatch.Empty,
      false,
      'should NOT match Null and NaN with Empty',
    ],
    [
      [MappingType.ValueToText, SpecialValueMatch.Null],
      SpecialValueMatch.Null,
      false,
      'should NOT match non-special value',
    ],
  ])('%s', ([mappingsType, optionsMatch], valueMatch, expected, _) => {
    const field = makeField(mappingsType, optionsMatch);

    expect(hasSpecialMappedValue(field, valueMatch)).toEqual(expected);
  });
});
