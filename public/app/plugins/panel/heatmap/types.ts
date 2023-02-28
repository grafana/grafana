export * from './panelcfg.gen';

import { AxisPlacement, HeatmapCellLayout } from '@grafana/schema';

import {
  defaultPanelOptions as defaultPanelOptionsGen,
  HeatmapColorMode,
  HeatmapColorScale,
  PanelOptions,
} from './panelcfg.gen';

defaultPanelOptionsGen.color!.mode = HeatmapColorMode.Scheme;
defaultPanelOptionsGen.color!.scale = HeatmapColorScale.Exponential;
defaultPanelOptionsGen.yAxis = {
  axisPlacement: AxisPlacement.Left,
};
defaultPanelOptionsGen.rowsFrame = {
  layout: HeatmapCellLayout.auto,
};

export const defaultPanelOptions = defaultPanelOptionsGen as PanelOptions;
