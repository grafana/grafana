import { LegendOptions, GraphTooltipOptions } from '@grafana/ui';

export interface GraphPanelOptions {
  legend: LegendOptions; // & GraphLegendEditorLegendOptions;
  tooltipOptions: GraphTooltipOption;
}

export interface GraphFieldConfig {
  showAxis: boolean;
}
  