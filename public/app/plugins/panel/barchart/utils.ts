import {
  ArrayVector,
  DataFrame,
  Field,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldSeriesColor,
  MutableDataFrame,
  VizOrientation,
} from '@grafana/data';
import { BarChartFieldConfig, BarChartOptions, defaultBarChartFieldConfig } from './types';
import { BarsOptions, getConfig } from './bars';
import {
  AxisPlacement,
  FIXED_UNIT,
  ScaleDirection,
  ScaleDistribution,
  ScaleOrientation,
  UPlotConfigBuilder,
  UPlotConfigPrepFn,
} from '@grafana/ui';

/** @alpha */
function getBarCharScaleOrientation(orientation: VizOrientation) {
  if (orientation === VizOrientation.Vertical) {
    return {
      xOri: ScaleOrientation.Horizontal,
      xDir: ScaleDirection.Right,
      yOri: ScaleOrientation.Vertical,
      yDir: ScaleDirection.Up,
    };
  }

  return {
    xOri: ScaleOrientation.Vertical,
    xDir: ScaleDirection.Down,
    yOri: ScaleOrientation.Horizontal,
    yDir: ScaleDirection.Right,
  };
}

export const preparePlotConfigBuilder: UPlotConfigPrepFn<BarChartOptions> = ({
  frame,
  theme,
  orientation,
  showValue,
  groupWidth,
  barWidth,
  text,
}) => {
  const builder = new UPlotConfigBuilder();
  const defaultValueFormatter = (seriesIdx: number, value: any) =>
    formattedValueToString(frame.fields[seriesIdx].display!(value));

  // bar orientation -> x scale orientation & direction
  const vizOrientation = getBarCharScaleOrientation(orientation);

  const formatValue = defaultValueFormatter;

  // Use bar width when only one field
  if (frame.fields.length === 2) {
    groupWidth = barWidth;
    barWidth = 1;
  }

  const opts: BarsOptions = {
    xOri: vizOrientation.xOri,
    xDir: vizOrientation.xDir,
    groupWidth,
    barWidth,
    formatValue,
    text,
    showValue,
  };

  const config = getConfig(opts, theme);

  builder.setCursor(config.cursor);

  builder.addHook('init', config.init);
  builder.addHook('drawClear', config.drawClear);
  builder.addHook('draw', config.draw);

  builder.setTooltipInterpolator(config.interpolateTooltip);

  builder.addScale({
    scaleKey: 'x',
    isTime: false,
    distribution: ScaleDistribution.Ordinal,
    orientation: vizOrientation.xOri,
    direction: vizOrientation.xDir,
  });

  builder.addAxis({
    scaleKey: 'x',
    isTime: false,
    placement: vizOrientation.xOri === 0 ? AxisPlacement.Bottom : AxisPlacement.Left,
    splits: config.xSplits,
    values: config.xValues,
    grid: false,
    ticks: false,
    gap: 15,
    theme,
  });

  let seriesIndex = 0;

  // iterate the y values
  for (let i = 1; i < frame.fields.length; i++) {
    const field = frame.fields[i];

    field.state!.seriesIndex = seriesIndex++;

    const customConfig: BarChartFieldConfig = { ...defaultBarChartFieldConfig, ...field.config.custom };

    const scaleKey = field.config.unit || FIXED_UNIT;
    const colorMode = getFieldColorModeForField(field);
    const scaleColor = getFieldSeriesColor(field, theme);
    const seriesColor = scaleColor.color;

    builder.addSeries({
      scaleKey,
      pxAlign: true,
      lineWidth: customConfig.lineWidth,
      lineColor: seriesColor,
      fillOpacity: customConfig.fillOpacity,
      theme,
      colorMode,
      pathBuilder: config.barsBuilder,
      show: !customConfig.hideFrom?.viz,
      gradientMode: customConfig.gradientMode,
      thresholds: field.config.thresholds,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      dataFrameFieldIndex: {
        fieldIndex: i,
        frameIndex: 0,
      },
    });

    // The builder will manage unique scaleKeys and combine where appropriate
    builder.addScale({
      scaleKey,
      min: field.config.min,
      max: field.config.max,
      softMin: customConfig.axisSoftMin,
      softMax: customConfig.axisSoftMax,
      orientation: vizOrientation.yOri,
      direction: vizOrientation.yDir,
    });

    if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
      let placement = customConfig.axisPlacement;
      if (!placement || placement === AxisPlacement.Auto) {
        placement = AxisPlacement.Left;
      }
      if (vizOrientation.xOri === 1) {
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
};

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

/** @internal */
export function prepareGraphableFrames(series: DataFrame[]): { frames?: DataFrame[]; warn?: string } {
  if (!series?.length) {
    return { warn: 'No data in response' };
  }

  const frames: DataFrame[] = [];
  const firstFrame = series[0];

  if (!firstFrame.fields.some((f) => f.type === FieldType.string)) {
    return {
      warn: 'Bar charts requires a string field',
    };
  }

  if (!firstFrame.fields.some((f) => f.type === FieldType.number)) {
    return {
      warn: 'No numeric fields found',
    };
  }

  for (let frame of series) {
    const fields: Field[] = [];
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        let copy = {
          ...field,
          values: new ArrayVector(
            field.values.toArray().map((v) => {
              if (!(Number.isFinite(v) || v == null)) {
                return null;
              }
              return v;
            })
          ),
        };
        fields.push(copy);
      } else {
        fields.push({ ...field });
      }
    }

    frames.push({
      ...frame,
      fields,
    });
  }

  return { frames };
}
