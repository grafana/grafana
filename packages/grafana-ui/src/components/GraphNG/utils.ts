import { GraphNGLegendEventMode } from './types';
import {
  DataFrame,
  FieldConfig,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldDisplayName,
  getFieldSeriesColor,
  GrafanaTheme,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { AxisPlacement, DrawStyle, GraphFieldConfig, PointVisibility, ScaleDirection, ScaleOrientation } from '..';
import { FIXED_UNIT } from '../../index';
import { AlignedData } from 'uplot';
import isNumber from 'lodash/isNumber';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));
const defaultConfig: GraphFieldConfig = {
  drawStyle: DrawStyle.Line,
  showPoints: PointVisibility.Auto,
  axisPlacement: AxisPlacement.Auto,
};

export function mapMouseEventToMode(event: React.MouseEvent): GraphNGLegendEventMode {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return GraphNGLegendEventMode.AppendToSelection;
  }
  return GraphNGLegendEventMode.ToggleSelection;
}

export function preparePlotData(frame: DataFrame): AlignedData {
  return frame.fields.map((f) => {
    if (f.type === FieldType.time) {
      if (f.values.length > 0 && typeof f.values.get(0) === 'string') {
        const timestamps = [];
        for (let i = 0; i < f.values.length; i++) {
          timestamps.push(dateTime(f.values.get(i)).valueOf());
        }
        return timestamps;
      }
      return f.values.toArray();
    }

    return f.values.toArray();
  }) as AlignedData;
}

export function preparePlotConfigBuilder(
  frame: DataFrame,
  timeRange: TimeRange,
  timeZone: TimeZone,
  theme: GrafanaTheme
): UPlotConfigBuilder {
  const builder = new UPlotConfigBuilder();

  // X is the first field in the aligned frame
  const xField = frame.fields[0];
  let seriesIndex = 0;

  if (xField.type === FieldType.time) {
    builder.addScale({
      scaleKey: 'x',
      orientation: ScaleOrientation.Horizontal,
      direction: ScaleDirection.Right,
      isTime: true,
      range: () => {
        const r = timeRange;
        return [r.from.valueOf(), r.to.valueOf()];
      },
    });

    builder.addAxis({
      scaleKey: 'x',
      isTime: true,
      placement: AxisPlacement.Bottom,
      timeZone,
      theme,
    });
  } else {
    // Not time!
    builder.addScale({
      scaleKey: 'x',
      orientation: ScaleOrientation.Horizontal,
      direction: ScaleDirection.Right,
    });

    builder.addAxis({
      scaleKey: 'x',
      placement: AxisPlacement.Bottom,
      theme,
    });
  }

  let indexByName: Map<string, number> | undefined = undefined;

  for (let i = 0; i < frame.fields.length; i++) {
    const field = frame.fields[i];
    const config = field.config as FieldConfig<GraphFieldConfig>;
    const customConfig: GraphFieldConfig = {
      ...defaultConfig,
      ...config.custom,
    };

    if (field === xField || field.type !== FieldType.number) {
      continue;
    }
    field.state!.seriesIndex = seriesIndex++;

    const fmt = field.display ?? defaultFormatter;
    const scaleKey = config.unit || FIXED_UNIT;
    const colorMode = getFieldColorModeForField(field);
    const scaleColor = getFieldSeriesColor(field, theme);
    const seriesColor = scaleColor.color;

    // The builder will manage unique scaleKeys and combine where appropriate
    builder.addScale({
      scaleKey,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      distribution: customConfig.scaleDistribution?.type,
      log: customConfig.scaleDistribution?.log,
      min: field.config.min,
      max: field.config.max,
      softMin: customConfig.axisSoftMin,
      softMax: customConfig.axisSoftMax,
    });

    if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
      builder.addAxis({
        scaleKey,
        label: customConfig.axisLabel,
        size: customConfig.axisWidth,
        placement: customConfig.axisPlacement ?? AxisPlacement.Auto,
        formatValue: (v) => formattedValueToString(fmt(v)),
        theme,
      });
    }

    const showPoints = customConfig.drawStyle === DrawStyle.Points ? PointVisibility.Always : customConfig.showPoints;

    let { fillOpacity } = customConfig;
    if (customConfig.fillBelowTo) {
      if (!indexByName) {
        indexByName = getNamesToFieldIndex(frame);
      }
      const t = indexByName.get(getFieldDisplayName(field, frame));
      const b = indexByName.get(customConfig.fillBelowTo);
      if (isNumber(b) && isNumber(t)) {
        builder.addBand({
          series: [t, b],
          fill: null as any, // using null will have the band use fill options from `t`
        });
      }
      if (!fillOpacity) {
        fillOpacity = 35; // default from flot
      }
    }

    builder.addSeries({
      scaleKey,
      showPoints,
      colorMode,
      fillOpacity,
      theme,
      drawStyle: customConfig.drawStyle!,
      lineColor: customConfig.lineColor ?? seriesColor,
      lineWidth: customConfig.lineWidth,
      lineInterpolation: customConfig.lineInterpolation,
      lineStyle: customConfig.lineStyle,
      barAlignment: customConfig.barAlignment,
      pointSize: customConfig.pointSize,
      pointColor: customConfig.pointColor ?? seriesColor,
      spanNulls: customConfig.spanNulls || false,
      show: !customConfig.hideFrom?.graph,
      gradientMode: customConfig.gradientMode,
      thresholds: config.thresholds,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      dataFrameFieldIndex: field.state?.origin,
      fieldName: getFieldDisplayName(field, frame),
      hideInLegend: customConfig.hideFrom?.legend,
    });
  }

  return builder;
}

export function getNamesToFieldIndex(frame: DataFrame): Map<string, number> {
  const names = new Map<string, number>();
  for (let i = 0; i < frame.fields.length; i++) {
    names.set(getFieldDisplayName(frame.fields[i], frame), i);
  }
  return names;
}

export function isRangeEqual(range1: TimeRange, range2: TimeRange) {
  return range1.raw.from === range2.raw.from && range1.raw.to === range2.raw.to;
}
