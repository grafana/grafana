import { LegendOptions, GraphTooltipOptions } from '@grafana/ui';

export type LegendPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface GraphOptions {
  // Redraw as time passes
  realTimeUpdates?: boolean;
}

export interface Options {
  graph: GraphOptions;
  legend: Omit<LegendOptions, 'placement'> &
    GraphLegendEditorLegendOptions & {
      placement: LegendPlacement;
    };
  tooltipOptions: GraphTooltipOptions;
}

export interface GraphLegendEditorLegendOptions extends LegendOptions {
  stats?: string[];
  decimals?: number;
  sortBy?: string;
  sortDesc?: boolean;
}
