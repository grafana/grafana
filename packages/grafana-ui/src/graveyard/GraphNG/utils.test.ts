import {
  createTheme,
  DashboardCursorSync,
  DataFrame,
  DefaultTimeZone,
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
          values: [1, 2, 4, 6, 100], // should find smallest delta === 1 from here
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
            },
          },
          values: [1, 1, 1, 1, 1],
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
          values: [30, 40, 50, 90, 100], // should be appended with two smallest-delta increments
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
            },
          },
          values: [2, 2, 2, 2, 2], // bar series should be appended with nulls
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Line,
            },
          },
          values: [3, 3, 3, 3, 3], // line series should be appended with undefineds
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
          values: [1, 1.1], // should not trip up on smaller deltas of non-bars
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            custom: {
              drawStyle: GraphDrawStyle.Line,
            },
          },
          values: [4, 4],
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
          values: [4, 4],
        },
      ],
    };

    let aligndFrame = preparePlotFrame([df1, df2, df3], {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    });

    expect(aligndFrame).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "config": {},
            "name": "time",
            "state": {
              "nullThresholdApplied": true,
              "origin": {
                "fieldIndex": 0,
                "frameIndex": 0,
              },
            },
            "type": "time",
            "values": [
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
          {
            "config": {
              "custom": {
                "drawStyle": "bars",
                "spanNulls": -1,
              },
            },
            "labels": {
              "name": "A",
            },
            "name": "value",
            "state": {
              "origin": {
                "fieldIndex": 1,
                "frameIndex": 0,
              },
            },
            "type": "number",
            "values": [
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
          {
            "config": {
              "custom": {
                "drawStyle": "bars",
                "spanNulls": -1,
              },
            },
            "labels": {
              "name": "B",
            },
            "name": "value",
            "state": {
              "origin": {
                "fieldIndex": 1,
                "frameIndex": 1,
              },
            },
            "type": "number",
            "values": [
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
          {
            "config": {
              "custom": {
                "drawStyle": "line",
              },
            },
            "labels": {
              "name": "B",
            },
            "name": "value",
            "state": {
              "origin": {
                "fieldIndex": 2,
                "frameIndex": 1,
              },
            },
            "type": "number",
            "values": [
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
          {
            "config": {
              "custom": {
                "drawStyle": "line",
              },
            },
            "labels": {
              "name": "C",
            },
            "name": "value",
            "state": {
              "origin": {
                "fieldIndex": 1,
                "frameIndex": 2,
              },
            },
            "type": "number",
            "values": [
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
          {
            "config": {
              "custom": {
                "drawStyle": "bars",
                "hideFrom": {
                  "viz": true,
                },
              },
            },
            "labels": {
              "name": "C",
            },
            "name": "value",
            "state": {
              "origin": {
                "fieldIndex": 2,
                "frameIndex": 2,
              },
            },
            "type": "number",
            "values": [
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
