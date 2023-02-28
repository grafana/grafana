export {
  HeatmapColorMode,
  HeatmapColorScale,
  HeatmapColorOptions,
  YAxisConfig,
  CellValues,
  FilterValueRange,
  HeatmapTooltip,
  HeatmapLegend,
  ExemplarConfig,
  RowsHeatmapOptions,
  PanelOptions,
  PanelFieldConfig,
} from './panelcfg.gen';

import { defaultPanelOptions as defaultPanelOptionsGen, PanelOptions } from './panelcfg.gen';

//avoid type assertion
export const defaultPanelOptions: PanelOptions = {
  ...defaultPanelOptionsGen,
  calculation: defaultPanelOptionsGen.calculation!,
  cellValues: defaultPanelOptionsGen.cellValues!,
  color: defaultPanelOptionsGen.color!,
  tooltip: defaultPanelOptionsGen.tooltip!,
  legend: defaultPanelOptionsGen.legend!,
  yAxis: defaultPanelOptionsGen.yAxis!,
  exemplars: defaultPanelOptionsGen.exemplars!,
  filterValues: defaultPanelOptionsGen.filterValues!,
  rowsFrame: defaultPanelOptionsGen.rowsFrame!,
  showValue: defaultPanelOptionsGen.showValue!,
};
