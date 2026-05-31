import { type AlignedData } from 'uplot';

import { formattedValueToString, type GrafanaTheme2 } from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation, VisibilityMode } from '@grafana/schema';
import { FIXED_UNIT, UPlotConfigBuilder } from '@grafana/ui';

import { getBoxplotDrawConfig } from './drawBoxes';
import { type BoxplotData } from './fields';
import { type FieldConfig, type Options, defaultFieldConfig } from './panelcfg.gen';

interface PrepConfigOpts {
  data: BoxplotData;
  options: Options;
  theme: GrafanaTheme2;
}

const HIDDEN_SERIES = {
  lineColor: 'rgba(0,0,0,0)',
  lineWidth: 0,
  pathBuilder: () => null,
  showPoints: VisibilityMode.Never,
};

export function prepConfig({ data, options, theme }: PrepConfigOpts): {
  builder: UPlotConfigBuilder;
  alignedData: AlignedData;
} {
  const { rows, valueField } = data;
  const N = rows.length;
  const builder = new UPlotConfigBuilder();

  const customConfig: FieldConfig = { ...defaultFieldConfig, ...valueField?.config.custom };
  const scaleKey = valueField?.config.unit || FIXED_UNIT;

  // X: one evenly spaced slot per row.
  builder.addScale({
    scaleKey: 'x',
    isTime: false,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: () => [-0.5, Math.max(0.5, N - 0.5)],
  });

  builder.addAxis({
    scaleKey: 'x',
    isTime: false,
    placement: AxisPlacement.Bottom,
    splits: () => rows.map((_, i) => i),
    values: () => data.categories,
    grid: { show: false },
    ticks: { show: true },
    theme,
  });

  // Y: value scale. Range comes from the hidden low/high anchor series below.
  builder.addScale({
    scaleKey,
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
    min: valueField?.config.min,
    max: valueField?.config.max,
    softMin: customConfig.axisSoftMin,
    softMax: customConfig.axisSoftMax,
    centeredZero: customConfig.axisCenteredZero,
    distribution: customConfig.scaleDistribution?.type ?? ScaleDistribution.Linear,
    log: customConfig.scaleDistribution?.log,
    decimals: valueField?.config.decimals,
  });

  if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
    builder.addAxis({
      scaleKey,
      placement: customConfig.axisPlacement === AxisPlacement.Right ? AxisPlacement.Right : AxisPlacement.Left,
      label: customConfig.axisLabel,
      size: customConfig.axisWidth,
      grid: { show: customConfig.axisGridShow ?? true },
      formatValue: (v, decimals) =>
        valueField?.display ? formattedValueToString(valueField.display(v, decimals)) : String(v),
      theme,
      decimals: valueField?.config.decimals,
    });
  }

  const { cursor, draw } = getBoxplotDrawConfig({
    rows,
    scaleKey,
    boxWidth: options.boxWidth ?? 0.6,
    lineWidth: customConfig.lineWidth ?? 1,
    fillOpacity: customConfig.fillOpacity ?? 60,
    outlierSize: options.outlierSize ?? 4,
    theme,
  });

  builder.setCursor(cursor);
  builder.addHook('draw', draw);

  // Two invisible anchor series carry each box's lowest/highest drawn value so
  // uPlot auto-ranges the y scale over whiskers and outliers (the boxes themselves
  // are rendered by the draw hook above).
  builder.addSeries({ scaleKey, theme, ...HIDDEN_SERIES });
  builder.addSeries({ scaleKey, theme, ...HIDDEN_SERIES });

  const lows = rows.map((r) => Math.min(r.q1, r.median, r.whiskerLo, r.outlierLo ?? Infinity));
  const highs = rows.map((r) => Math.max(r.q3, r.median, r.whiskerHi, r.outlierHi ?? -Infinity));

  const alignedData: AlignedData = [rows.map((_, i) => i), lows, highs];

  return { builder, alignedData };
}
