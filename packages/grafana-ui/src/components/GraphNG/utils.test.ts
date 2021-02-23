import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import {
  DefaultTimeZone,
  FieldConfig,
  FieldMatcherID,
  fieldMatchers,
  FieldType,
  getDefaultTimeRange,
  GrafanaTheme,
  MutableDataFrame,
} from '@grafana/data';
import { BarAlignment, DrawStyle, GraphFieldConfig, GraphGradientMode, LineInterpolation, PointVisibility } from '..';

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

  return preparePlotFrame([df1, df2], {
    x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
    y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
  });
}

describe('GraphNG utils', () => {
  test('preparePlotConfigBuilder', () => {
    const frame = mockDataFrame();
    expect(
      preparePlotConfigBuilder(
        frame!,
        { colors: { panelBg: '#000000' } } as GrafanaTheme,
        getDefaultTimeRange,
        () => DefaultTimeZone
      )
    ).toMatchSnapshot();
  });
});
