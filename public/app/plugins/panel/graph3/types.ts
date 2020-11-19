import { LegendOptions, GraphTooltipOptions, LegendPlacement } from '@grafana/ui';

export interface GraphOptions {
  // Redraw as time passes
  realTimeUpdates?: boolean;
}

export interface Options {
  graph: GraphOptions;
  legend: GraphLegendEditorLegendOptions & {
    placement: LegendPlacement;
  };
  tooltipOptions: GraphTooltipOptions;
}

export interface GraphLegendEditorLegendOptions extends Omit<LegendOptions, 'placement'> {
  stats?: string[];
  decimals?: number;
  sortBy?: string;
  sortDesc?: boolean;
}
