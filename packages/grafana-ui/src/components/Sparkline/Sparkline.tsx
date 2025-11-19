import React, { memo } from 'react';

import {
  DataFrame,
  FieldConfig,
  FieldSparkline,
  FieldType,
  getFieldColorModeForField,
  GrafanaTheme2,
  nullToValue,
} from '@grafana/data';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  VisibilityMode,
  ScaleDirection,
  ScaleOrientation,
} from '@grafana/schema';

import { Themeable2 } from '../../types/theme';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

import { getYRange, preparePlotFrame } from './utils';

export interface SparklineProps extends Themeable2 {
  width: number;
  height: number;
  config?: FieldConfig<GraphFieldConfig>;
  sparkline: FieldSparkline;
}

const defaultConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  showPoints: VisibilityMode.Auto,
  axisPlacement: AxisPlacement.Hidden,
  pointSize: 2,
};

const prepareConfig = (sparkline: FieldSparkline, dataFrame: DataFrame, theme: GrafanaTheme2): UPlotConfigBuilder => {
  const builder = new UPlotConfigBuilder();

  builder.setCursor({
    show: false,
    x: false,
    y: false,
  });

  // X is the first field in the aligned frame
  const xField = dataFrame.fields[0];
  builder.addScale({
    scaleKey: 'x',
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    isTime: false,
    range: () => {
      if (sparkline.x) {
        if (sparkline.timeRange && sparkline.x.type === FieldType.time) {
          return [sparkline.timeRange.from.valueOf(), sparkline.timeRange.to.valueOf()];
        }
        const vals = sparkline.x.values;
        return [vals[0], vals[vals.length - 1]];
      }
      return [0, sparkline.y.values.length - 1];
    },
  });

  builder.addAxis({
    scaleKey: 'x',
    theme,
    placement: AxisPlacement.Hidden,
  });

  for (let i = 0; i < dataFrame.fields.length; i++) {
    const field = dataFrame.fields[i];
    const config: FieldConfig<GraphFieldConfig> = field.config;
    const customConfig: GraphFieldConfig = {
      ...defaultConfig,
      ...config.custom,
    };

    if (field === xField || field.type !== FieldType.number) {
      continue;
    }

    const scaleKey = config.unit || '__fixed';
    builder.addScale({
      scaleKey,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      range: () => getYRange(field, dataFrame),
    });

    builder.addAxis({
      scaleKey,
      theme,
      placement: AxisPlacement.Hidden,
    });

    const colorMode = getFieldColorModeForField(field);
    const seriesColor = colorMode.getCalculator(field, theme)(0, 0);
    const pointsMode =
      customConfig.drawStyle === GraphDrawStyle.Points ? VisibilityMode.Always : customConfig.showPoints;

    builder.addSeries({
      pxAlign: false,
      scaleKey,
      theme,
      colorMode,
      thresholds: config.thresholds,
      drawStyle: customConfig.drawStyle!,
      lineColor: customConfig.lineColor ?? seriesColor,
      lineWidth: customConfig.lineWidth,
      lineInterpolation: customConfig.lineInterpolation,
      showPoints: pointsMode,
      pointSize: customConfig.pointSize,
      fillOpacity: customConfig.fillOpacity,
      fillColor: customConfig.fillColor,
      lineStyle: customConfig.lineStyle,
      gradientMode: customConfig.gradientMode,
      spanNulls: customConfig.spanNulls,
    });
  }

  return builder;
};

export const Sparkline: React.FC<SparklineProps> = memo((props) => {
  const { sparkline, config: fieldConfig, theme, width, height } = props;
  const alignedDataFrame = nullToValue(preparePlotFrame(sparkline, fieldConfig));
  // do not render sparklines for fields with 1 or less values - this can cause an infinite loop in uPlot
  if (alignedDataFrame.fields.some((f) => f.values.length <= 1)) {
    return null;
  }

  const data = preparePlotData2(alignedDataFrame, getStackingGroups(alignedDataFrame));
  const configBuilder = prepareConfig(sparkline, alignedDataFrame, theme);

  return <UPlotChart data={data} config={configBuilder} width={width} height={height} />;
});
Sparkline.displayName = 'Sparkline';
