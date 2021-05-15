import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import {
  DataFrame,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldDisplayName,
  getFieldSeriesColor,
  GrafanaTheme,
  MutableDataFrame,
  VizOrientation,
} from '@grafana/data';
import { BarChartFieldConfig, BarChartOptions, BarValueVisibility, defaultBarChartFieldConfig } from './types';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation } from '../uPlot/config';
import { BarsOptions, getConfig } from './bars';
import { FIXED_UNIT } from '../GraphNG/GraphNG';

/** @alpha */
export function preparePlotConfigBuilder(
  data: DataFrame,
  theme: GrafanaTheme,
  { orientation, showValue, groupWidth, barWidth }: BarChartOptions
) {
  const builder = new UPlotConfigBuilder();

  // bar orientation -> x scale orientation & direction
  let xOri = ScaleOrientation.Vertical;
  let xDir = ScaleDirection.Down;
  let yOri = ScaleOrientation.Horizontal;
  let yDir = ScaleDirection.Right;

  if (orientation === VizOrientation.Vertical) {
    xOri = ScaleOrientation.Horizontal;
    xDir = ScaleDirection.Right;
    yOri = ScaleOrientation.Vertical;
    yDir = ScaleDirection.Up;
  }

  const formatValue =
    showValue !== BarValueVisibility.Never
      ? (seriesIdx: number, value: any) => formattedValueToString(data.fields[seriesIdx].display!(value))
      : undefined;

  // Use bar width when only one field
  if (data.fields.length === 2) {
    groupWidth = barWidth;
    barWidth = 1;
  }

  const opts: BarsOptions = {
    xOri,
    xDir,
    groupWidth,
    barWidth,
    formatValue,
    onHover: (seriesIdx: number, valueIdx: number) => {
      console.log('hover', { seriesIdx, valueIdx });
    },
    onLeave: (seriesIdx: number, valueIdx: number) => {
      console.log('leave', { seriesIdx, valueIdx });
    },
  };

  const config = getConfig(opts);

  builder.addHook('init', config.init);
  builder.addHook('drawClear', config.drawClear);
  builder.addHook('setCursor', config.setCursor);

  builder.setCursor(config.cursor);
  builder.setSelect(config.select);

  builder.addScale({
    scaleKey: 'x',
    isTime: false,
    distribution: ScaleDistribution.Ordinal,
    orientation: xOri,
    direction: xDir,
  });

  builder.addAxis({
    scaleKey: 'x',
    isTime: false,
    placement: xOri === 0 ? AxisPlacement.Bottom : AxisPlacement.Left,
    splits: config.xSplits,
    values: config.xValues,
    grid: false,
    ticks: false,
    gap: 15,
    theme,
  });

  let seriesIndex = 0;

  // iterate the y values
  for (let i = 1; i < data.fields.length; i++) {
    const field = data.fields[i];

    field.state!.seriesIndex = seriesIndex++;

    const customConfig: BarChartFieldConfig = { ...defaultBarChartFieldConfig, ...field.config.custom };

    const scaleKey = field.config.unit || FIXED_UNIT;
    const colorMode = getFieldColorModeForField(field);
    const scaleColor = getFieldSeriesColor(field, theme);
    const seriesColor = scaleColor.color;

    builder.addSeries({
      scaleKey,
      pxAlign: false,
      lineWidth: customConfig.lineWidth,
      lineColor: seriesColor,
      //lineStyle: customConfig.lineStyle,
      fillOpacity: customConfig.fillOpacity,
      theme,
      colorMode,
      pathBuilder: config.drawBars,
      pointsBuilder: config.drawPoints,
      show: !customConfig.hideFrom?.graph,
      gradientMode: customConfig.gradientMode,
      thresholds: field.config.thresholds,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      dataFrameFieldIndex: {
        fieldIndex: i,
        frameIndex: 0,
      },
      fieldName: getFieldDisplayName(field, data),
      hideInLegend: customConfig.hideFrom?.legend,
    });

    // The builder will manage unique scaleKeys and combine where appropriate
    builder.addScale({
      scaleKey,
      min: field.config.min,
      max: field.config.max,
      softMin: customConfig.axisSoftMin,
      softMax: customConfig.axisSoftMax,
      orientation: yOri,
      direction: yDir,
    });

    if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
      let placement = customConfig.axisPlacement;
      if (!placement || placement === AxisPlacement.Auto) {
        placement = AxisPlacement.Left;
      }
      if (xOri === 1) {
        if (placement === AxisPlacement.Left) {
          placement = AxisPlacement.Bottom;
        }
        if (placement === AxisPlacement.Right) {
          placement = AxisPlacement.Top;
        }
      }

      builder.addAxis({
        scaleKey,
        label: customConfig.axisLabel,
        size: customConfig.axisWidth,
        placement,
        formatValue: (v) => formattedValueToString(field.display!(v)),
        theme,
      });
    }
  }

  return builder;
}

/** @internal */
export function preparePlotFrame(data: DataFrame[]) {
  const firstFrame = data[0];
  const firstString = firstFrame.fields.find((f) => f.type === FieldType.string);

  if (!firstString) {
    throw new Error('No string field in DF');
  }

  const resultFrame = new MutableDataFrame();
  resultFrame.addField(firstString);

  for (const f of firstFrame.fields) {
    if (f.type === FieldType.number) {
      resultFrame.addField(f);
    }
  }

  return resultFrame;
}
