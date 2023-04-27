export * from './panelcfg.gen';

import { AxisPlacement, HeatmapCellLayout } from '@grafana/schema';

import {
  defaultPanelOptions as defaultPanelOptionsGen,
  HeatmapColorMode,
  HeatmapColorScale,
  PanelOptions,
} from './panelcfg.gen';

export const defaultPanelOptions = {
  ...defaultPanelOptionsGen,
  color: { ...defaultPanelOptionsGen.color, mode: HeatmapColorMode.Scheme, scale: HeatmapColorScale.Exponential },
  yAxis: { ...defaultPanelOptionsGen.yAxis, axisPlacement: AxisPlacement.Left },
  rowsFrame: { ...defaultPanelOptionsGen.rowsFrame, layout: HeatmapCellLayout.auto },
} as PanelOptions;
