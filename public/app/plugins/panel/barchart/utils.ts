import {
  ArrayVector,
  DataFrame,
  Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldColorModeForField,
  getFieldSeriesColor,
  GrafanaTheme2,
  MutableDataFrame,
  VizOrientation,
} from '@grafana/data';
import { BarChartFieldConfig, BarChartOptions, defaultBarChartFieldConfig } from './types';
import { BarsOptions, getConfig } from './bars';
import { FIXED_UNIT, measureText, UPlotConfigBuilder, UPlotConfigPrepFn, UPLOT_AXIS_FONT_SIZE } from '@grafana/ui';
import { Padding } from 'uplot';
import {
  AxisPlacement,
  ScaleDirection,
  ScaleDistribution,
  ScaleOrientation,
  StackingMode,
  VizLegendOptions,
} from '@grafana/schema';
import { collectStackingGroups, orderIdsByCalcs } from '../../../../../packages/grafana-ui/src/components/uPlot/utils';
import { orderBy } from 'lodash';

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
  stacking,
  text,
  rawValue,
  allFrames,
  xTickLabelRotation,
  xTickLabelMaxLength,
  legend,
}) => {
  const builder = new UPlotConfigBuilder();
  const defaultValueFormatter = (seriesIdx: number, value: any) => {
    return shortenValue(formattedValueToString(frame.fields[seriesIdx].display!(value)), xTickLabelMaxLength);
  };

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
    stacking,
    rawValue,
    formatValue,
    text,
    showValue,
    legend,
  };

  const config = getConfig(opts, theme);

  builder.setCursor(config.cursor);

  builder.addHook('init', config.init);
  builder.addHook('drawClear', config.drawClear);
  builder.addHook('draw', config.draw);

  builder.setTooltipInterpolator(config.interpolateTooltip);

  if (vizOrientation.xOri === ScaleOrientation.Horizontal && xTickLabelRotation !== 0) {
    builder.setPadding(getRotationPadding(frame, xTickLabelRotation, xTickLabelMaxLength));
  }

  builder.setPrepData(config.prepData);

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
    label: frame.fields[0].config.custom?.axisLabel,
    splits: config.xSplits,
    values: config.xValues,
    grid: { show: false },
    ticks: { show: false },
    gap: 15,
    tickLabelRotation: xTickLabelRotation * -1,
    theme,
  });

  let seriesIndex = 0;
  const legendOrdered = isLegendOrdered(legend);
  const stackingGroups: Map<string, number[]> = new Map();

  // iterate the y values
  for (let i = 1; i < frame.fields.length; i++) {
    const field = frame.fields[i];

    seriesIndex++;

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
      hardMin: field.config.min,
      hardMax: field.config.max,
      softMin: customConfig.axisSoftMin,
      softMax: customConfig.axisSoftMax,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      // PlotLegend currently gets unfiltered DataFrame[], so index must be into that field array, not the prepped frame's which we're iterating here
      dataFrameFieldIndex: {
        fieldIndex: legendOrdered
          ? i
          : allFrames[0].fields.findIndex(
              (f) => f.type === FieldType.number && f.state?.seriesIndex === seriesIndex - 1
            ),
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
        grid: { show: customConfig.axisGridShow },
      });
    }

    collectStackingGroups(field, stackingGroups, seriesIndex);
  }

  if (stackingGroups.size !== 0) {
    builder.setStacking(true);
    for (const [_, seriesIds] of stackingGroups.entries()) {
      const seriesIdxs = orderIdsByCalcs({ ids: seriesIds, legend, frame });
      for (let j = seriesIdxs.length - 1; j > 0; j--) {
        builder.addBand({
          series: [seriesIdxs[j], seriesIdxs[j - 1]],
        });
      }
    }
  }

  return builder;
};

function shortenValue(value: string, length: number) {
  if (value.length > length) {
    return value.substring(0, length).concat('...');
  } else {
    return value;
  }
}

function getRotationPadding(frame: DataFrame, rotateLabel: number, valueMaxLength: number): Padding {
  const values = frame.fields[0].values;
  const fontSize = UPLOT_AXIS_FONT_SIZE;
  const displayProcessor = frame.fields[0].display ?? ((v) => v);
  let maxLength = 0;
  for (let i = 0; i < values.length; i++) {
    let size = measureText(
      shortenValue(formattedValueToString(displayProcessor(values.get(i))), valueMaxLength),
      fontSize
    );
    maxLength = size.width > maxLength ? size.width : maxLength;
  }

  // Add padding to the right if the labels are rotated in a way that makes the last label extend outside the graph.
  const paddingRight =
    rotateLabel > 0
      ? Math.cos((rotateLabel * Math.PI) / 180) *
        measureText(
          shortenValue(formattedValueToString(displayProcessor(values.get(values.length - 1))), valueMaxLength),
          fontSize
        ).width
      : 0;

  // Add padding to the left if the labels are rotated in a way that makes the first label extend outside the graph.
  const paddingLeft =
    rotateLabel < 0
      ? Math.cos((rotateLabel * -1 * Math.PI) / 180) *
        measureText(shortenValue(formattedValueToString(displayProcessor(values.get(0))), valueMaxLength), fontSize)
          .width
      : 0;

  // Add padding to the bottom to avoid clipping the rotated labels.
  const paddingBottom = Math.sin(((rotateLabel >= 0 ? rotateLabel : rotateLabel * -1) * Math.PI) / 180) * maxLength;

  return [0, paddingRight, paddingBottom, paddingLeft];
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

/** @internal */
export function prepareGraphableFrames(
  series: DataFrame[],
  theme: GrafanaTheme2,
  options: BarChartOptions
): { frames?: DataFrame[]; warn?: string } {
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

  const legendOrdered = isLegendOrdered(options.legend);
  let seriesIndex = 0;

  for (let frame of series) {
    const fields: Field[] = [];
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        field.state = field.state ?? {};

        field.state.seriesIndex = seriesIndex++;

        let copy = {
          ...field,
          config: {
            ...field.config,
            custom: {
              ...field.config.custom,
              stacking: {
                group: '_',
                mode: options.stacking,
              },
            },
          },
          values: new ArrayVector(
            field.values.toArray().map((v) => {
              if (!(Number.isFinite(v) || v == null)) {
                return null;
              }
              return v;
            })
          ),
        };

        if (options.stacking === StackingMode.Percent) {
          copy.config.unit = 'percentunit';
          copy.display = getDisplayProcessor({ field: copy, theme });
        }

        fields.push(copy);
      } else {
        fields.push({ ...field });
      }
    }

    let orderedFields: Field[] | undefined;

    if (legendOrdered) {
      orderedFields = orderBy(
        fields,
        ({ state }) => {
          return state?.calcs?.[options.legend.sortBy!.toLowerCase()];
        },
        options.legend.sortDesc ? 'desc' : 'asc'
      );
      // The string field needs to be the first one
      if (orderedFields[orderedFields.length - 1].type === FieldType.string) {
        orderedFields.unshift(orderedFields.pop()!);
      }
    }

    frames.push({
      ...frame,
      fields: orderedFields || fields,
    });
  }

  return { frames };
}

export const isLegendOrdered = (options: VizLegendOptions) => Boolean(options?.sortBy && options.sortDesc !== null);
