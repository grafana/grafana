export * from './panelcfg.gen';

import { AxisPlacement, HeatmapCellLayout } from '@grafana/schema';

import { defaultOptions as defaultOptionsGen, HeatmapColorMode, HeatmapColorScale, Options } from './panelcfg.gen';

export const defaultOptions = {
  ...defaultOptionsGen,
  color: { ...defaultOptionsGen.color, mode: HeatmapColorMode.Scheme, scale: HeatmapColorScale.Exponential },
  yAxis: { ...defaultOptionsGen.yAxis, axisPlacement: AxisPlacement.Left },
  rowsFrame: { ...defaultOptionsGen.rowsFrame, layout: HeatmapCellLayout.auto },
} as Options;
