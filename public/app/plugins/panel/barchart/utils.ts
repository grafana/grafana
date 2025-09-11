import uPlot, { Padding } from 'uplot';

import {
  DataFrame,
  Field,
  FieldConfigSource,
  FieldType,
  GrafanaTheme2,
  cacheFieldDisplayNames,
  formattedValueToString,
  getDisplayProcessor,
  getFieldColorModeForField,
  getFieldSeriesColor,
  outerJoinDataFrames,
} from '@grafana/data';
import { decoupleHideFromState } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import {
  AxisColorMode,
  AxisPlacement,
  FieldColorModeId,
  GraphThresholdsStyleMode,
  GraphTransform,
  ScaleDistribution,
  TimeZone,
  TooltipDisplayMode,
  VizOrientation,
} from '@grafana/schema';
import {
  FIXED_UNIT,
  ScaleDirection,
  ScaleOrientation,
  StackingMode,
  UPlotConfigBuilder,
  measureText,
} from '@grafana/ui';
import { AxisProps, UPLOT_AXIS_FONT_SIZE, getStackingGroups } from '@grafana/ui/internal';

import { setClassicPaletteIdxs } from '../timeseries/utils';

import { BarsOptions, getConfig } from './bars';
import { singleBarMarker } from './barmarkers';
import { FieldConfig, Options, defaultFieldConfig } from './panelcfg.gen';

// import { isLegendOrdered } from './utils';

interface BarSeries {
  series: DataFrame[];
  _rest: Field[];
  color?: Field | null;
  warn?: string | null;
}

export function prepSeries(
  frames: DataFrame[],
  fieldConfig: FieldConfigSource,
  stacking: StackingMode,
  theme: GrafanaTheme2,
  xFieldName?: string,
  colorFieldName?: string
): BarSeries {
  // this allows PanelDataErrorView to show the default noValue message
  if (frames.length === 0 || frames.every((fr) => fr.length === 0)) {
    return {
      warn: '',
      series: [],
      _rest: [],
    };
  }

  cacheFieldDisplayNames(frames);
  decoupleHideFromState(frames, fieldConfig);
 
  let frame: DataFrame | undefined = { ...frames[0] };

  // auto-sort and/or join on first time field (if any)
  // TODO: should this always join on the xField (if supplied?)
  const timeFieldIdx = frame.fields.findIndex((f) => f.type === FieldType.time);

  if (timeFieldIdx >= 0 && frames.length > 1) {
    frame = outerJoinDataFrames({ frames, keepDisplayNames: true }) ?? frame;
  }

  const xField =
    // TODO: use matcher
    frame.fields.find((field) => field.state?.displayName === xFieldName || field.name === xFieldName) ??
    frame.fields.find((field) => field.type === FieldType.string) ??
    frame.fields[timeFieldIdx];

  if (xField != null) {
    const fields: Field[] = [xField];
    const _rest: Field[] = [];

    const colorField =
      colorFieldName == null
        ? undefined
        : frame.fields.find(
            // TODO: use matcher
            (field) => field.state?.displayName === colorFieldName || field.name === colorFieldName
          );

    frame.fields.forEach((field) => {
      if (field !== xField) {
        if (field.type === FieldType.number && !field.config.custom?.hideFrom?.viz) {
          const field2 = {
            ...field,
            values: field.values.map((v) => (Number.isFinite(v) ? v : null)),
            // TODO: stacking should be moved from panel opts to fieldConfig (like TimeSeries) so we dont have to do this
            config: {
              ...field.config,
              custom: {
                ...field.config.custom,
                stacking: {
                  group: '_',
                  mode: stacking,
                },
              },
            },
          };

          fields.push(field2);
        } else {
          _rest.push(field);
        }
      }
    });

    let warn: string | null = null;

    if (fields.length === 1) {
      warn = t('bar-chart.warn.missing-numeric', 'No numeric fields found');
    }

    frame.fields = fields;

    const series = [frame];

    setClassicPaletteIdxs(series, theme, 0);

    return {
      series,
      _rest,
      color: colorField,
      warn,
    };
  }

  return {
    series: [],
    _rest: [],
    color: null,
    warn: t('bar-chart.warn.missing-series', 'Bar charts require a string or time field'),
  };
}

export interface PrepConfigOpts {
  series: DataFrame[]; // series with hideFrom.viz: false
  totalSeries: number; // total series count (including hidden)
  color?: Field | null;
  orientation: VizOrientation;
  options: Options;
  timeZone: TimeZone;
  theme: GrafanaTheme2;
}

export const prepConfig = ({ series, totalSeries, color, orientation, options, timeZone, theme }: PrepConfigOpts) => {
  let {
    showValue,
    groupWidth,
    barWidth,
    barRadius = 0,
    stacking,
    text,
    tooltip,
    xTickLabelRotation,
    xTickLabelMaxLength,
    xTickLabelSpacing = 0,
    legend,
    fullHighlight,
  } = options;
  // this and color is kept up to date by returned prepData()
  let frame = series[0];

  const builder = new UPlotConfigBuilder();

  const formatters = frame.fields.map((f, i) => {
    if (stacking === StackingMode.Percent) {
      return getDisplayProcessor({
        field: {
          ...f,
          config: {
            ...f.config,
            unit: 'percentunit',
          },
        },
        theme,
      });
    }

    return f.display!;
  });

  const formatValue = (seriesIdx: number, value: unknown) => {
    return formattedValueToString(formatters[seriesIdx](value));
  };

  const formatShortValue = (seriesIdx: number, value: unknown) => {
    return shortenValue(formatValue(seriesIdx, value), xTickLabelMaxLength);
  };

  // bar orientation -> x scale orientation & direction
  const vizOrientation = getScaleOrientation(orientation);

  // Use bar width when only one field
  if (frame.fields.length === 2 && stacking === StackingMode.None) {
    if (totalSeries === 1) {
      groupWidth = barWidth;
    }

    barWidth = 1;
  }

  const rawValue = (seriesIdx: number, valueIdx: number) => {
    return frame.fields[seriesIdx].values[valueIdx];
  };

  // Color by value
  let getColor: ((seriesIdx: number, valueIdx: number) => string) | undefined = undefined;

  let fillOpacity = 1;

  if (color != null) {
    const disp = color.display!;
    fillOpacity = (color.config.custom.fillOpacity ?? 100) / 100;
    // gradientMode? ignore?
    getColor = (seriesIdx: number, valueIdx: number) => disp(color!.values[valueIdx]).color!;
  } else {
    const hasPerBarColor = frame.fields.some((f) => {
      const fromThresholds = f.config.color?.mode === FieldColorModeId.Thresholds;

      return (
        fromThresholds ||
        f.config.mappings?.some((m) => {
          // ValueToText mappings have a different format, where all of them are grouped into an object keyed by value
          if (m.type === 'value') {
            // === MappingType.ValueToText
            return Object.values(m.options).some((result) => result.color != null);
          }
          return m.options.result.color != null;
        })
      );
    });

    if (hasPerBarColor) {
      // use opacity from first numeric field
      let opacityField = frame.fields.find((f) => f.type === FieldType.number)!;

      fillOpacity = (opacityField?.config?.custom?.fillOpacity ?? 100) / 100;

      getColor = (seriesIdx: number, valueIdx: number) => {
        let field = frame.fields[seriesIdx];
        return field.display!(field.values[valueIdx]).color!;
      };
    }
  }

  const opts: BarsOptions = {
    xOri: vizOrientation.xOri,
    xDir: vizOrientation.xDir,
    groupWidth,
    barWidth,
    barRadius,
    stacking,
    rawValue,
    getColor,
    fillOpacity,
    formatValue,
    formatShortValue,
    timeZone,
    text,
    showValue,
    legend,
    xSpacing: xTickLabelSpacing,
    xTimeAuto: frame.fields[0]?.type === FieldType.time && !frame.fields[0].config.unit?.startsWith('time:'),
    negY: frame.fields.map((f) => f.config.custom?.transform === GraphTransform.NegativeY),
    fullHighlight,
    hoverMulti: tooltip.mode === TooltipDisplayMode.Multi,
  };

  const config = getConfig(opts, theme);

  builder.setCursor(config.cursor);

  builder.addHook('init', config.init);
  builder.addHook('drawClear', config.drawClear);

  builder.addHook('draw', singleBarMarker(builder)); // example marker



  

  if (xTickLabelRotation !== 0) {
    // these are the amount of space we already have available between plot edge and first label
    // TODO: removing these hardcoded value requires reading back uplot instance props
    let lftSpace = 50;
    let btmSpace = vizOrientation.xOri === ScaleOrientation.Horizontal ? 14 : 5;

    builder.setPadding(getRotationPadding(frame, xTickLabelRotation, xTickLabelMaxLength, lftSpace, btmSpace));
  }

  builder.setPrepData(config.prepData);

  builder.addScale({
    scaleKey: 'x',
    isTime: false,
    range: config.xRange,
    distribution: ScaleDistribution.Ordinal,
    orientation: vizOrientation.xOri,
    direction: vizOrientation.xDir,
  });

  const xFieldAxisPlacement =
    frame.fields[0]?.config.custom?.axisPlacement !== AxisPlacement.Hidden
      ? vizOrientation.xOri === ScaleOrientation.Horizontal
        ? AxisPlacement.Bottom
        : AxisPlacement.Left
      : AxisPlacement.Hidden;
  const xFieldAxisShow = frame.fields[0]?.config.custom?.axisPlacement !== AxisPlacement.Hidden;

  builder.addAxis({
    scaleKey: 'x',
    isTime: false,
    placement: xFieldAxisPlacement,
    label: frame.fields[0]?.config.custom?.axisLabel,
    splits: config.xSplits,
    filter: vizOrientation.xOri === 0 ? config.hFilter : undefined,
    values: config.xValues,
    timeZone,
    grid: { show: false },
    ticks: { show: false },
    gap: 15,
    tickLabelRotation: vizOrientation.xOri === 0 ? xTickLabelRotation * -1 : 0,
    theme,
    show: xFieldAxisShow,
  });

  // let seriesIndex = 0;
  // const legendOrdered = isLegendOrdered(legend);

  // iterate the y values
  for (let i = 1; i < frame.fields.length; i++) {
    const field = frame.fields[i];

    // seriesIndex++;

    const customConfig: FieldConfig = { ...defaultFieldConfig, ...field.config.custom };

    const scaleKey = field.config.unit || FIXED_UNIT;
    const colorMode = getFieldColorModeForField(field);
    const scaleColor = getFieldSeriesColor(field, theme);
    const seriesColor = scaleColor.color;

    // make barcharts start at 0 unless explicitly overridden
    let softMin = customConfig.axisSoftMin;
    let softMax = customConfig.axisSoftMax;

    if (softMin == null && field.config.min == null) {
      softMin = 0;
    }

    if (softMax == null && field.config.max == null) {
      softMax = 0;
    }

    // Render thresholds in graph
    if (customConfig.thresholdsStyle && field.config.thresholds) {
      const thresholdDisplay = customConfig.thresholdsStyle.mode ?? GraphThresholdsStyleMode.Off;
      if (thresholdDisplay !== GraphThresholdsStyleMode.Off) {
        builder.addThresholds({
          config: customConfig.thresholdsStyle,
          thresholds: field.config.thresholds,
          scaleKey,
          theme,
          hardMin: field.config.min,
          hardMax: field.config.max,
          softMin: customConfig.axisSoftMin,
          softMax: customConfig.axisSoftMax,
        });
      }
    }

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
      // dataFrameFieldIndex: {
      //   fieldIndex: legendOrdered
      //     ? i
      //     : allFrames[0].fields.findIndex(
      //         (f) => f.type === FieldType.number && f.state?.seriesIndex === seriesIndex - 1
      //       ),
      //   frameIndex: 0,
      // },
    });

    // The builder will manage unique scaleKeys and combine where appropriate
    builder.addScale({
      scaleKey,
      min: field.config.min,
      max: field.config.max,
      softMin,
      softMax,
      centeredZero: customConfig.axisCenteredZero,
      orientation: vizOrientation.yOri,
      direction: vizOrientation.yDir,
      distribution: customConfig.scaleDistribution?.type,
      log: customConfig.scaleDistribution?.log,
      decimals: field.config.decimals,
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

      let axisOpts: AxisProps = {
        scaleKey,
        label: customConfig.axisLabel,
        size: customConfig.axisWidth,
        placement,
        formatValue: (v, decimals) => formattedValueToString(field.display!(v, decimals)),
        filter: vizOrientation.yOri === 0 ? config.hFilter : undefined,
        tickLabelRotation: vizOrientation.xOri === 1 ? xTickLabelRotation * -1 : 0,
        theme,
        grid: { show: customConfig.axisGridShow },
        decimals: field.config.decimals,
      };

      if (customConfig.axisBorderShow) {
        axisOpts.border = {
          show: true,
        };
      }

      if (customConfig.axisColorMode === AxisColorMode.Series) {
        axisOpts.color = seriesColor;
      }

      builder.addAxis(axisOpts);

      
    }
  }

  let stackingGroups = getStackingGroups(frame);

  builder.setStackingGroups(stackingGroups);

  return {
    builder,
    prepData: (_series: DataFrame[], _color?: Field | null) => {
      series = _series;
      frame = series[0];
      color = _color;

      return builder.prepData!(series);
    },
  };
};

function shortenValue(value: string, length: number) {
  if (value.length > length) {
    return value.substring(0, length).concat('...');
  } else {
    return value;
  }
}

function getRotationPadding(
  frame: DataFrame,
  rotateLabel: number,
  valueMaxLength: number,
  lftSpace = 0,
  btmSpace = 0
): Padding {
  const values = frame.fields[0].values;
  const fontSize = UPLOT_AXIS_FONT_SIZE;
  const displayProcessor = frame.fields[0].display;
  const getProcessedValue = (i: number) => {
    return displayProcessor ? displayProcessor(values[i]) : values[i];
  };
  let maxLength = 0;
  for (let i = 0; i < values.length; i++) {
    let size = measureText(shortenValue(formattedValueToString(getProcessedValue(i)), valueMaxLength), fontSize);
    maxLength = size.width > maxLength ? size.width : maxLength;
  }

  // Add padding to the right if the labels are rotated in a way that makes the last label extend outside the graph.
  const paddingRight =
    rotateLabel > 0
      ? Math.cos((rotateLabel * Math.PI) / 180) *
        measureText(
          shortenValue(formattedValueToString(getProcessedValue(values.length - 1)), valueMaxLength),
          fontSize
        ).width
      : 0;

  // Add padding to the left if the labels are rotated in a way that makes the first label extend outside the graph.
  const paddingLeft =
    rotateLabel < 0
      ? Math.cos((rotateLabel * -1 * Math.PI) / 180) *
        measureText(shortenValue(formattedValueToString(getProcessedValue(0)), valueMaxLength), fontSize).width
      : 0;

  // Add padding to the bottom to avoid clipping the rotated labels.
  const paddingBottom =
    Math.sin(((rotateLabel >= 0 ? rotateLabel : rotateLabel * -1) * Math.PI) / 180) * maxLength - btmSpace;

  return [
    Math.round(UPLOT_AXIS_FONT_SIZE * uPlot.pxRatio),
    paddingRight,
    paddingBottom,
    Math.max(0, paddingLeft - lftSpace),
  ];
}

function getScaleOrientation(orientation: VizOrientation) {
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
