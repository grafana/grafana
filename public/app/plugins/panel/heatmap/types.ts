import { AxisPlacement, HeatmapCellLayout } from '@grafana/schema';
import {
  Options,
  defaultOptions as defaultOptionsGen,
  HeatmapColorMode,
  HeatmapColorScale,
} from '@grafana/schema/src/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

export const defaultOptions = {
  ...defaultOptionsGen,
  color: { ...defaultOptionsGen.color, mode: HeatmapColorMode.Scheme, scale: HeatmapColorScale.Exponential },
  yAxis: { ...defaultOptionsGen.yAxis, axisPlacement: AxisPlacement.Left },
  rowsFrame: { ...defaultOptionsGen.rowsFrame, layout: HeatmapCellLayout.auto },
} as Options;
