export * from './panelcfg.gen';

import { AxisPlacement, HeatmapCellLayout } from '@grafana/schema';

import {
  defaultPanelOptions as defaultPanelOptionsGen,
  HeatmapColorMode,
  HeatmapColorScale,
  PanelOptions,
} from './panelcfg.gen';

export const defaultPanelOptions: PanelOptions = {
  ...defaultPanelOptionsGen,
  calculation: defaultPanelOptionsGen.calculation!,
  cellValues: defaultPanelOptionsGen.cellValues!,
  color: {
    ...defaultPanelOptionsGen.color!,
    mode: HeatmapColorMode.Scheme,
    scale: HeatmapColorScale.Exponential,
  },
  tooltip: defaultPanelOptionsGen.tooltip!,
  legend: defaultPanelOptionsGen.legend!,
  yAxis: {
    axisPlacement: AxisPlacement.Left,
  },
  exemplars: defaultPanelOptionsGen.exemplars!,
  filterValues: defaultPanelOptionsGen.filterValues!,
  rowsFrame: {
    layout: HeatmapCellLayout.auto,
  },
  showValue: defaultPanelOptionsGen.showValue!,
};
