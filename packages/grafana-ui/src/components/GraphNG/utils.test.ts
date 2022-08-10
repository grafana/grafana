import {
  ArrayVector,
  createTheme,
  DashboardCursorSync,
  DataFrame,
  DefaultTimeZone,
  EventBusSrv,
  FieldColorModeId,
  FieldConfig,
  FieldMatcherID,
  fieldMatchers,
  FieldType,
  getDefaultTimeRange,
  MutableDataFrame,
} from '@grafana/data';
import {
  BarAlignment,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  VisibilityMode,
  StackingMode,
} from '@grafana/schema';

import { preparePlotConfigBuilder } from '../TimeSeries/utils';

import { preparePlotFrame } from './utils';

function mockDataFrame() {
  const df1 = new MutableDataFrame({
    refId: 'A',
    fields: [{ name: 'ts', type: FieldType.time, values: [1, 2, 3] }],
  });
  const df2 = new MutableDataFrame({
    refId: 'B',
    fields: [{ name: 'ts', type: FieldType.time, values: [1, 2, 4] }],
  });

  const f1Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 1',
    color: {
      mode: FieldColorModeId.Fixed,
    },
    decimals: 2,
    custom: {
      drawStyle: GraphDrawStyle.Line,
      gradientMode: GraphGradientMode.Opacity,
      lineColor: '#ff0000',
      lineWidth: 2,
      lineInterpolation: LineInterpolation.Linear,
      lineStyle: {
        fill: 'dash',
        dash: [1, 2],
      },
      spanNulls: false,
      fillColor: '#ff0000',
      fillOpacity: 0.1,
      showPoints: VisibilityMode.Always,
      stacking: {
        group: 'A',
        mode: StackingMode.Normal,
      },
    },
  };

  const f2Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 2',
    color: {
      mode: FieldColorModeId.Fixed,
    },
    decimals: 2,
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      gradientMode: GraphGradientMode.Hue,
      lineColor: '#ff0000',
      lineWidth: 2,
      lineInterpolation: LineInterpolation.Linear,
      lineStyle: {
        fill: 'dash',
        dash: [1, 2],
      },
      barAlignment: BarAlignment.Before,
      fillColor: '#ff0000',
      fillOpacity: 0.1,
      showPoints: VisibilityMode.Always,
      stacking: {
        group: 'A',
        mode: StackingMode.Normal,
      },
    },
  };

  const f3Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 3',
    decimals: 2,
    color: {
      mode: FieldColorModeId.Fixed,
    },
    custom: {
      drawStyle: GraphDrawStyle.Line,
      gradientMode: GraphGradientMode.Opacity,
      lineColor: '#ff0000',
      lineWidth: 2,
      lineInterpolation: LineInterpolation.Linear,
      lineStyle: {
        fill: 'dash',
        dash: [1, 2],
      },
      spanNulls: false,
      fillColor: '#ff0000',
      fillOpacity: 0.1,
      showPoints: VisibilityMode.Always,
      stacking: {
        group: 'B',
        mode: StackingMode.Normal,
      },
    },
  };
  const f4Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 4',
    decimals: 2,
    color: {
      mode: FieldColorModeId.Fixed,
    },
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      gradientMode: GraphGradientMode.Hue,
      lineColor: '#ff0000',
      lineWidth: 2,
      lineInterpolation: LineInterpolation.Linear,
      lineStyle: {
        fill: 'dash',
        dash: [1, 2],
      },
      barAlignment: BarAlignment.Before,
      fillColor: '#ff0000',
      fillOpacity: 0.1,
      showPoints: VisibilityMode.Always,
      stacking: {
        group: 'B',
        mode: StackingMode.Normal,
      },
    },
  };
  const f5Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 4',
    decimals: 2,
    color: {
      mode: FieldColorModeId.Fixed,
    },
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      gradientMode: GraphGradientMode.Hue,
      lineColor: '#ff0000',
      lineWidth: 2,
      lineInterpolation: LineInterpolation.Linear,
      lineStyle: {
        fill: 'dash',
        dash: [1, 2],
      },
      barAlignment: BarAlignment.Before,
      fillColor: '#ff0000',
      fillOpacity: 0.1,
      showPoints: VisibilityMode.Always,
      stacking: {
        group: 'B',
        mode: StackingMode.None,
      },
    },
  };

  df1.addField({
    name: 'metric1',
    type: FieldType.number,
    config: f1Config,
  });

  df2.addField({
    name: 'metric2',
    type: FieldType.number,
    config: f2Config,
  });
  df2.addField({
    name: 'metric3',
    type: FieldType.number,
    config: f3Config,
  });
  df2.addField({
    name: 'metric4',
    type: FieldType.number,
    config: f4Config,
  });
  df2.addField({
    name: 'metric5',
    type: FieldType.number,
    config: f5Config,
  });

  return preparePlotFrame([df1, df2], {
    x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
    y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
  });
}

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  DefaultTimeZone: 'utc',
}));

describe('GraphNG utils', () => {
  test('preparePlotConfigBuilder', () => {
    const frame = mockDataFrame();
    const result = preparePlotConfigBuilder({
      frame: frame!,
      theme: createTheme(),
      timeZones: [DefaultTimeZone],
      getTimeRange: getDefaultTimeRange,
      eventBus: new EventBusSrv(),
      sync: () => DashboardCursorSync.Tooltip,
      allFrames: [frame!],
    }).getConfig();
    expect(result).toMatchSnapshot();
  });

  test('preparePlotFrame appends min bar spaced nulls when > 1 bar series', () => {
    const df1: DataFrame = {
      name: 'A',
      length: 5,
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          config: {},
          values: new ArrayVector([1, 2, 4, 6, 100]), // should find smallest delta === 1 from here
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
            },
          },
          values: new ArrayVector([1, 1, 1, 1, 1]),
        },
      ],
    };

    const df2: DataFrame = {
      name: 'B',
      length: 5,
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          config: {},
          values: new ArrayVector([30, 40, 50, 90, 100]), // should be appended with two smallest-delta increments
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
            },
          },
          values: new ArrayVector([2, 2, 2, 2, 2]), // bar series should be appended with nulls
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Line,
            },
          },
          values: new ArrayVector([3, 3, 3, 3, 3]), // line series should be appended with undefineds
        },
      ],
    };

    const df3: DataFrame = {
      name: 'C',
      length: 2,
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          config: {},
          values: new ArrayVector([1, 1.1]), // should not trip up on smaller deltas of non-bars
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Line,
            },
          },
          values: new ArrayVector([4, 4]),
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
              hideFrom: {
                viz: true, // should ignore hidden bar series
              },
            },
          },
          values: new ArrayVector([4, 4]),
        },
      ],
    };

    let aligndFrame = preparePlotFrame([df1, df2, df3], {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    });

    expect(aligndFrame).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "name": "time",
            "state": Object {
              "nullThresholdApplied": true,
              "origin": Object {
                "fieldIndex": 0,
                "frameIndex": 0,
              },
            },
            "type": "time",
            "values": Array [
              1,
              1.1,
              2,
              4,
              6,
              30,
              40,
              50,
              90,
              100,
              101,
              102,
            ],
          },
          Object {
            "config": Object {
              "custom": Object {
                "drawStyle": "bars",
                "spanNulls": -1,
              },
            },
            "labels": Object {
              "name": "A",
            },
            "name": "value",
            "state": Object {
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 0,
              },
            },
            "type": "number",
            "values": Array [
              1,
              undefined,
              1,
              1,
              1,
              undefined,
              undefined,
              undefined,
              undefined,
              1,
              null,
              null,
            ],
          },
          Object {
            "config": Object {
              "custom": Object {
                "drawStyle": "bars",
                "spanNulls": -1,
              },
            },
            "labels": Object {
              "name": "B",
            },
            "name": "value",
            "state": Object {
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 1,
              },
            },
            "type": "number",
            "values": Array [
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              2,
              2,
              2,
              2,
              2,
              null,
              null,
            ],
          },
          Object {
            "config": Object {
              "custom": Object {
                "drawStyle": "line",
              },
            },
            "labels": Object {
              "name": "B",
            },
            "name": "value",
            "state": Object {
              "origin": Object {
                "fieldIndex": 2,
                "frameIndex": 1,
              },
            },
            "type": "number",
            "values": Array [
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              3,
              3,
              3,
              3,
              3,
              undefined,
              undefined,
            ],
          },
          Object {
            "config": Object {
              "custom": Object {
                "drawStyle": "line",
              },
            },
            "labels": Object {
              "name": "C",
            },
            "name": "value",
            "state": Object {
              "origin": Object {
                "fieldIndex": 1,
                "frameIndex": 2,
              },
            },
            "type": "number",
            "values": Array [
              4,
              4,
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
            ],
          },
          Object {
            "config": Object {
              "custom": Object {
                "drawStyle": "bars",
                "hideFrom": Object {
                  "viz": true,
                },
              },
            },
            "labels": Object {
              "name": "C",
            },
            "name": "value",
            "state": Object {
              "origin": Object {
                "fieldIndex": 2,
                "frameIndex": 2,
              },
            },
            "type": "number",
            "values": Array [
              4,
              4,
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
            ],
          },
        ],
        "length": 12,
      }
    `);
  });
});
