import { createDataFrame, dateTime, type DateTimeInput, type EventBus, FieldType } from '@grafana/data';
import { getTheme } from '@grafana/ui';

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

describe('custom Y-axis tick configuration', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      getStream: jest.fn(),
      subscribe: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    };
  });

  function buildConfig(fieldConfig: Record<string, unknown>) {
    const frame = createDataFrame({
      fields: [
        {
          config: {},
          values: [1667406900000, 1667407170000, 1667407185000],
          name: 'Time',
          type: FieldType.time,
        },
        {
          config: { custom: fieldConfig },
          values: [10, 200, 350],
          name: 'Value',
          type: FieldType.number,
        },
      ],
    });

    const builder = preparePlotConfigBuilder({
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

    return builder.getConfig();
  }

  it('should set axis splits when axisTickPositions is provided', () => {
    const config = buildConfig({ axisTickPositions: '0, 90, 180, 270, 360' });
    // axes[0] is the time x-axis, axes[1] is the y-axis
    expect(config.axes![1]!.splits).toEqual([0, 90, 180, 270, 360]);
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should set axis incrs when axisTickInterval is provided', () => {
    const config = buildConfig({ axisTickInterval: '90' });
    expect(config.axes![1]!.incrs).toEqual([90]);
    expect(config.axes![1]!.splits).toBeUndefined();
  });

  it('should prefer axisTickPositions over axisTickInterval when both are set', () => {
    const config = buildConfig({ axisTickPositions: '0, 100, 200', axisTickInterval: '50' });
    expect(config.axes![1]!.splits).toEqual([0, 100, 200]);
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should not set splits or incrs when neither is provided', () => {
    const config = buildConfig({});
    expect(config.axes![1]!.splits).toBeUndefined();
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should ignore invalid values in axisTickPositions', () => {
    const config = buildConfig({ axisTickPositions: 'abc, , 90, xyz, 180' });
    expect(config.axes![1]!.splits).toEqual([90, 180]);
  });

  it('should fall through to auto when axisTickPositions is empty string', () => {
    const config = buildConfig({ axisTickPositions: '' });
    expect(config.axes![1]!.splits).toBeUndefined();
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should fall through to auto when axisTickPositions is whitespace only', () => {
    const config = buildConfig({ axisTickPositions: '   ' });
    expect(config.axes![1]!.splits).toBeUndefined();
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should ignore axisTickInterval of zero', () => {
    const config = buildConfig({ axisTickInterval: '0' });
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should ignore negative axisTickInterval', () => {
    const config = buildConfig({ axisTickInterval: '-10' });
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should fall through to auto when axisTickInterval is empty string', () => {
    const config = buildConfig({ axisTickInterval: '' });
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should fall through to auto when axisTickInterval is whitespace only', () => {
    const config = buildConfig({ axisTickInterval: '   ' });
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should fall through to auto when all axisTickInterval values are invalid', () => {
    const config = buildConfig({ axisTickInterval: 'abc, xyz' });
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should handle axisTickPositions with various separators', () => {
    const config = buildConfig({ axisTickPositions: '0,90 180, 270  360' });
    expect(config.axes![1]!.splits).toEqual([0, 90, 180, 270, 360]);
  });

  it('should fall through to auto when all axisTickPositions values are invalid', () => {
    const config = buildConfig({ axisTickPositions: 'abc, xyz' });
    expect(config.axes![1]!.splits).toBeUndefined();
    expect(config.axes![1]!.incrs).toBeUndefined();
  });

  it('should handle decimal values in axisTickPositions', () => {
    const config = buildConfig({ axisTickPositions: '0.5, 1.5, 2.5' });
    expect(config.axes![1]!.splits).toEqual([0.5, 1.5, 2.5]);
  });

  it('should handle decimal axisTickInterval', () => {
    const config = buildConfig({ axisTickInterval: '0.5' });
    expect(config.axes![1]!.incrs).toEqual([0.5]);
  });

  it('should accept multiple comma-separated tick interval candidates', () => {
    const config = buildConfig({ axisTickInterval: '22.5, 45, 90' });
    expect(config.axes![1]!.incrs).toEqual([22.5, 45, 90]);
  });

  it('should sort tick interval candidates ascending', () => {
    const config = buildConfig({ axisTickInterval: '90, 22.5, 45' });
    expect(config.axes![1]!.incrs).toEqual([22.5, 45, 90]);
  });

  it('should filter out zero and negative values from tick interval candidates', () => {
    const config = buildConfig({ axisTickInterval: '-10, 0, 45, 90' });
    expect(config.axes![1]!.incrs).toEqual([45, 90]);
  });

  it('should handle negative values in axisTickPositions', () => {
    const config = buildConfig({ axisTickPositions: '-100, -50, 0, 50, 100' });
    expect(config.axes![1]!.splits).toEqual([-100, -50, 0, 50, 100]);
  });
});
