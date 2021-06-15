import { preparePlotFrame } from './utils';
import { preparePlotConfigBuilder } from '../TimeSeries/utils';
import {
  createTheme,
  DashboardCursorSync,
  DefaultTimeZone,
  EventBusSrv,
  FieldConfig,
  FieldMatcherID,
  fieldMatchers,
  FieldType,
  getDefaultTimeRange,
  MutableDataFrame,
} from '@grafana/data';
import {
  BarAlignment,
  DrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  PointVisibility,
  StackingMode,
} from '..';

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
    decimals: 2,
    custom: {
      drawStyle: DrawStyle.Line,
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
      showPoints: PointVisibility.Always,
      stacking: {
        group: 'A',
        mode: StackingMode.Normal,
      },
    },
  };

  const f2Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 2',
    decimals: 2,
    custom: {
      drawStyle: DrawStyle.Bars,
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
      showPoints: PointVisibility.Always,
      stacking: {
        group: 'A',
        mode: StackingMode.Normal,
      },
    },
  };

  const f3Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 3',
    decimals: 2,
    custom: {
      drawStyle: DrawStyle.Line,
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
      showPoints: PointVisibility.Always,
      stacking: {
        group: 'B',
        mode: StackingMode.Normal,
      },
    },
  };
  const f4Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 4',
    decimals: 2,
    custom: {
      drawStyle: DrawStyle.Bars,
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
      showPoints: PointVisibility.Always,
      stacking: {
        group: 'B',
        mode: StackingMode.Normal,
      },
    },
  };
  const f5Config: FieldConfig<GraphFieldConfig> = {
    displayName: 'Metric 4',
    decimals: 2,
    custom: {
      drawStyle: DrawStyle.Bars,
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
      showPoints: PointVisibility.Always,
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
  ...(jest.requireActual('@grafana/data') as any),
  DefaultTimeZone: 'utc',
}));

describe('GraphNG utils', () => {
  test('preparePlotConfigBuilder', () => {
    const frame = mockDataFrame();
    const result = preparePlotConfigBuilder({
      frame: frame!,
      theme: createTheme(),
      timeZone: DefaultTimeZone,
      getTimeRange: getDefaultTimeRange,
      eventBus: new EventBusSrv(),
      sync: DashboardCursorSync.Tooltip,
      allFrames: [frame!],
    }).getConfig();
    expect(result).toMatchSnapshot();
  });
});
