import {
  createDataFrame,
  dateTime,
  type DateTimeInput,
  type EventBus,
  FieldColorModeId,
  FieldType,
} from '@grafana/data';
import { getTheme } from '@grafana/ui/themes';

import { getXAxisConfig, preparePlotConfigBuilder, UPLOT_DEFAULT_AXIS_GAP } from './utils';

describe('when fill below to option is used', () => {
  let eventBus: EventBus;
  // eslint-disable-next-line
  let renderers: any[];
  // eslint-disable-next-line
  let tests: any;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      getStream: jest.fn(),
      subscribe: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    };
    renderers = [];

    tests = [
      {
        alignedFrame: {
          fields: [
            {
              config: {},
              values: [1667406900000, 1667407170000, 1667407185000],
              name: 'Time',
              state: { multipleFrames: true, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 0 } },
              type: FieldType.time,
            },
            {
              config: { displayNameFromDS: 'Test1', custom: { fillBelowTo: 'Test2' }, min: 0, max: 100 },
              values: [1, 2, 3],
              name: 'Value',
              state: { multipleFrames: true, displayName: 'Test1', origin: { fieldIndex: 1, frameIndex: 0 } },
              type: FieldType.number,
            },
            {
              config: { displayNameFromDS: 'Test2', min: 0, max: 100 },
              values: [4, 5, 6],
              name: 'Value',
              state: { multipleFrames: true, displayName: 'Test2', origin: { fieldIndex: 1, frameIndex: 1 } },
              type: FieldType.number,
            },
          ],
          length: 3,
        },
        allFrames: [
          {
            name: 'Test1',
            refId: 'A',
            fields: [
              {
                config: {},
                values: [1667406900000, 1667407170000, 1667407185000],
                name: 'Time',
                state: { multipleFrames: true, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 0 } },
                type: FieldType.time,
              },
              {
                config: { displayNameFromDS: 'Test1', custom: { fillBelowTo: 'Test2' }, min: 0, max: 100 },
                values: [1, 2, 3],
                name: 'Value',
                state: { multipleFrames: true, displayName: 'Test1', origin: { fieldIndex: 1, frameIndex: 0 } },
                type: FieldType.number,
              },
            ],
            length: 2,
          },
          {
            name: 'Test2',
            refId: 'B',
            fields: [
              {
                config: {},
                values: [1667406900000, 1667407170000, 1667407185000],
                name: 'Time',
                state: { multipleFrames: true, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 1 } },
                type: FieldType.time,
              },
              {
                config: { displayNameFromDS: 'Test2', min: 0, max: 100 },
                values: [1, 2, 3],
                name: 'Value',
                state: { multipleFrames: true, displayName: 'Test2', origin: { fieldIndex: 1, frameIndex: 1 } },
                type: FieldType.number,
              },
            ],
            length: 2,
          },
        ],
        expectedResult: 1,
      },
      {
        alignedFrame: {
          fields: [
            {
              config: {},
              values: [1667406900000, 1667407170000, 1667407185000],
              name: 'time',
              state: { multipleFrames: true, displayName: 'time', origin: { fieldIndex: 0, frameIndex: 0 } },
              type: FieldType.time,
            },
            {
              config: { custom: { fillBelowTo: 'below_value1' } },
              values: [1, 2, 3],
              name: 'value1',
              state: { multipleFrames: true, displayName: 'value1', origin: { fieldIndex: 1, frameIndex: 0 } },
              type: FieldType.number,
            },
            {
              config: { custom: { fillBelowTo: 'below_value2' } },
              values: [4, 5, 6],
              name: 'value2',
              state: { multipleFrames: true, displayName: 'value2', origin: { fieldIndex: 2, frameIndex: 0 } },
              type: FieldType.number,
            },
            {
              config: {},
              values: [4, 5, 6],
              name: 'below_value1',
              state: { multipleFrames: true, displayName: 'below_value1', origin: { fieldIndex: 1, frameIndex: 1 } },
              type: FieldType.number,
            },
            {
              config: {},
              values: [4, 5, 6],
              name: 'below_value2',
              state: { multipleFrames: true, displayName: 'below_value2', origin: { fieldIndex: 2, frameIndex: 1 } },
              type: FieldType.number,
            },
          ],
          length: 5,
        },
        allFrames: [
          {
            refId: 'A',
            fields: [
              {
                config: {},
                values: [1667406900000, 1667407170000, 1667407185000],
                name: 'time',
                state: { multipleFrames: true, displayName: 'time', origin: { fieldIndex: 0, frameIndex: 0 } },
                type: FieldType.time,
              },
              {
                config: { custom: { fillBelowTo: 'below_value1' } },
                values: [1, 2, 3],
                name: 'value1',
                state: { multipleFrames: true, displayName: 'value1', origin: { fieldIndex: 1, frameIndex: 0 } },
                type: FieldType.number,
              },
              {
                config: { custom: { fillBelowTo: 'below_value2' } },
                values: [4, 5, 6],
                name: 'value2',
                state: { multipleFrames: true, displayName: 'value2', origin: { fieldIndex: 2, frameIndex: 0 } },
                type: FieldType.number,
              },
            ],
            length: 3,
          },
          {
            refId: 'B',
            fields: [
              {
                config: {},
                values: [1667406900000, 1667407170000, 1667407185000],
                name: 'time',
                state: { multipleFrames: true, displayName: 'time', origin: { fieldIndex: 0, frameIndex: 1 } },
                type: FieldType.time,
              },
              {
                config: {},
                values: [4, 5, 6],
                name: 'below_value1',
                state: { multipleFrames: true, displayName: 'below_value1', origin: { fieldIndex: 1, frameIndex: 1 } },
                type: FieldType.number,
              },
              {
                config: {},
                values: [4, 5, 6],
                name: 'below_value2',
                state: { multipleFrames: true, displayName: 'below_value2', origin: { fieldIndex: 2, frameIndex: 1 } },
                type: FieldType.number,
              },
            ],
            length: 3,
          },
        ],
        expectedResult: 2,
      },
    ];
  });

  it('should verify if fill below to is set then builder bands are set', () => {
    for (const test of tests) {
      const builder = preparePlotConfigBuilder({
        frame: test.alignedFrame,
        //@ts-ignore
        theme: getTheme(),
        timeZones: ['browser'],
        getTimeRange: jest.fn(),
        eventBus,
        sync: jest.fn(),
        allFrames: test.allFrames,
        renderers,
      });

      //@ts-ignore
      expect(builder.bands.length).toBe(test.expectedResult);
    }
  });

  it('should verify if fill below to is not set then builder bands are empty', () => {
    tests[0].alignedFrame.fields[1].config.custom.fillBelowTo = undefined;
    tests[0].allFrames[0].fields[1].config.custom.fillBelowTo = undefined;
    tests[1].alignedFrame.fields[1].config.custom.fillBelowTo = undefined;
    tests[1].alignedFrame.fields[2].config.custom.fillBelowTo = undefined;
    tests[1].allFrames[0].fields[1].config.custom.fillBelowTo = undefined;
    tests[1].allFrames[0].fields[2].config.custom.fillBelowTo = undefined;
    tests[0].expectedResult = 0;
    tests[1].expectedResult = 0;

    for (const test of tests) {
      const builder = preparePlotConfigBuilder({
        frame: test.alignedFrame,
        //@ts-ignore
        theme: getTheme(),
        timeZones: ['browser'],
        getTimeRange: jest.fn(),
        eventBus,
        sync: jest.fn(),
        allFrames: test.allFrames,
        renderers,
      });

      //@ts-ignore
      expect(builder.bands.length).toBe(test.expectedResult);
    }
  });

  it('should verify if fill below to is set and field name is overriden then builder bands are set', () => {
    tests[0].alignedFrame.fields[2].config.displayName = 'newName';
    tests[0].alignedFrame.fields[2].state.displayName = 'newName';
    tests[0].allFrames[1].fields[1].config.displayName = 'newName';
    tests[0].allFrames[1].fields[1].state.displayName = 'newName';

    tests[1].alignedFrame.fields[3].config.displayName = 'newName';
    tests[1].alignedFrame.fields[3].state.displayName = 'newName';
    tests[1].allFrames[1].fields[1].config.displayName = 'newName';
    tests[1].allFrames[1].fields[1].state.displayName = 'newName';

    for (const test of tests) {
      const builder = preparePlotConfigBuilder({
        frame: test.alignedFrame,
        //@ts-ignore
        theme: getTheme(),
        timeZones: ['browser'],
        getTimeRange: jest.fn(),
        eventBus,
        sync: jest.fn(),
        allFrames: test.allFrames,
        renderers,
      });

      //@ts-ignore
      expect(builder.bands.length).toBe(test.expectedResult);
    }
  });
});

describe('time axis units', () => {
  it('should use default time unit formatting if no custom unit provided ', () => {
    const frame = createDataFrame({
      fields: [
        {
          config: {},
          values: [1667406900000, 1667407170000, 1667407185000],
          name: 'Time',
          type: FieldType.time,
        },
        {
          config: {},
          values: [1, 2, 3],
          name: 'Value',
          type: FieldType.number,
        },
        {
          config: {},
          values: [4, 5, 6],
          name: 'Value',
          type: FieldType.number,
        },
      ],
    });
    const eventBus = {
      publish: jest.fn(),
      getStream: jest.fn(),
      subscribe: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    };
    const builder = preparePlotConfigBuilder({
      frame,
      //@ts-ignore
      theme: getTheme(),
      timeZones: ['browser'],
      getTimeRange: jest.fn(),
      eventBus,
      sync: jest.fn(),
      allFrames: [frame],
      renderers: [],
    });
    const config = builder.getConfig();
    expect(config.axes![0]!.values).toEqual(expect.any(Function));
    // @ts-ignore
    expect(config.axes![0]!.values(config, [1667406900000, 1761316576114], 0, 100, 1000)).toEqual([
      '11:35:00',
      '09:36:16',
    ]);
  });

  it('should use custom time unit if provided ', () => {
    const frame = createDataFrame({
      fields: [
        {
          config: { unit: 'time: MM-DD' },
          values: [1667406900000, 1667407170000, 1667407185000],
          name: 'Time',
          state: { multipleFrames: true, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 0 } },
          type: FieldType.time,
          display: jest.fn((v) => ({ text: dateTime(v as DateTimeInput).format('MM-DD'), numeric: Number(v) })),
        },
        {
          config: {},
          values: [1, 2, 3],
          name: 'Value',
          state: { multipleFrames: true, displayName: 'Test1', origin: { fieldIndex: 1, frameIndex: 0 } },
          type: FieldType.number,
        },
        {
          config: {},
          values: [4, 5, 6],
          name: 'Value',
          state: { multipleFrames: true, displayName: 'Test2', origin: { fieldIndex: 1, frameIndex: 1 } },
          type: FieldType.number,
        },
      ],
    });
    const eventBus = {
      publish: jest.fn(),
      getStream: jest.fn(),
      subscribe: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    };
    const builder = preparePlotConfigBuilder({
      frame,
      //@ts-ignore
      theme: getTheme(),
      timeZones: ['browser'],
      getTimeRange: jest.fn(),
      eventBus,
      sync: jest.fn(),
      allFrames: [frame],
      renderers: [],
    });
    const config = builder.getConfig();
    expect(config.axes![0]!.values).toEqual(expect.any(Function));
    // @ts-ignore
    expect(config.axes![0]!.values(config, [1667406900000, 1761316576114], 0, 100, 1000)).toEqual(['11-02', '10-24']);
  });
});

describe('calculateAnnotationLaneSizes', () => {
  it('should not regress', () => {
    expect(getXAxisConfig()).toEqual(undefined);
    expect(getXAxisConfig(0)).toEqual(undefined);
  });
  it('should return config to resize x-axis size, gap, and ticks size', () => {
    expect(getXAxisConfig(2)).toEqual({
      gap: UPLOT_DEFAULT_AXIS_GAP,
      size: 36,
      ticks: {
        size: 19,
      },
    });
    expect(getXAxisConfig(3)).toEqual({
      gap: UPLOT_DEFAULT_AXIS_GAP,
      size: 43,
      ticks: {
        size: 26,
      },
    });
  });
});

describe('colorblind line style patterns', () => {
  const eventBus: EventBus = {
    publish: jest.fn(),
    getStream: jest.fn() as EventBus['getStream'],
    subscribe: jest.fn(),
    removeAllListeners: jest.fn(),
    newScopedBus: jest.fn(),
  };

  function buildWithLineStyle(lineStyle: object | undefined, fieldCount: number) {
    const fields: Array<Record<string, unknown>> = [
      {
        config: {},
        values: [1000, 2000, 3000],
        name: 'Time',
        state: { multipleFrames: false, displayName: 'Time', origin: { fieldIndex: 0, frameIndex: 0 } },
        type: FieldType.time,
      },
    ];

    for (let i = 0; i < fieldCount; i++) {
      fields.push({
        config: {
          color: { mode: FieldColorModeId.PaletteClassic },
          custom: lineStyle ? { lineStyle } : {},
        },
        values: [i + 1, i + 2, i + 3],
        name: `Series${i}`,
        state: {
          multipleFrames: false,
          displayName: `Series${i}`,
          origin: { fieldIndex: i + 1, frameIndex: 0 },
        },
        type: FieldType.number,
      });
    }

    const frame = createDataFrame({ fields });

    return preparePlotConfigBuilder({
      frame,
      // @ts-ignore
      theme: getTheme(),
      timeZones: ['browser'],
      getTimeRange: jest.fn(),
      eventBus,
      sync: jest.fn(),
      allFrames: [frame],
      renderers: [],
    });
  }

  it('should assign different patterns per series when colorblind line style is selected', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 3);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toEqual({ fill: 'solid' });
    expect(series[1].props.lineStyle).toEqual({ fill: 'dash', dash: [10, 10] });
    expect(series[2].props.lineStyle).toEqual({ fill: 'dash', dash: [20, 10] });
  });

  it('should cycle patterns after 9 series', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 10);
    const series = builder.getSeries();

    // 10th series (index 9) wraps to first pattern (9 % 9 = 0)
    expect(series[9].props.lineStyle).toEqual({ fill: 'solid' });
  });

  it('should assign all 9 distinct patterns before cycling', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 9);
    const series = builder.getSeries();
    const styles = series.map((s) => JSON.stringify(s.props.lineStyle));
    const unique = new Set(styles);
    expect(unique.size).toBe(9);
  });

  it('should use only solid and dash fills (no dot patterns)', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 9);
    const series = builder.getSeries();

    for (const s of series) {
      expect(s.props.lineStyle?.fill).toMatch(/^(solid|dash)$/);
    }
  });

  it('should not modify non-colorblind line styles', () => {
    const dashStyle = { fill: 'dash', dash: [50, 50] };
    const builder = buildWithLineStyle(dashStyle, 2);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toEqual(dashStyle);
    expect(series[1].props.lineStyle).toEqual(dashStyle);
  });

  it('should pass through solid line style unchanged', () => {
    const builder = buildWithLineStyle({ fill: 'solid' }, 2);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toEqual({ fill: 'solid' });
    expect(series[1].props.lineStyle).toEqual({ fill: 'solid' });
  });

  it('should pass through undefined line style', () => {
    const builder = buildWithLineStyle(undefined, 2);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toBeUndefined();
    expect(series[1].props.lineStyle).toBeUndefined();
  });

  it('should work with any color palette (decoupled from color mode)', () => {
    // Uses PaletteClassic (not colorblind palette) but colorblind line style
    const builder = buildWithLineStyle({ fill: 'accessible' }, 2);
    const series = builder.getSeries();

    expect(series[0].props.lineStyle).toEqual({ fill: 'solid' });
    expect(series[1].props.lineStyle).toEqual({ fill: 'dash', dash: [10, 10] });
  });

  it('should handle single series', () => {
    const builder = buildWithLineStyle({ fill: 'accessible' }, 1);
    const series = builder.getSeries();

    expect(series).toHaveLength(1);
    expect(series[0].props.lineStyle).toEqual({ fill: 'solid' });
  });
});
