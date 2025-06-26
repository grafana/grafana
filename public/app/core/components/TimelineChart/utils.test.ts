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
