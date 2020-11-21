import { FieldMatcherID, MatcherConfig } from '@grafana/data';
import { LegendOptions, GraphTooltipOptions } from '@grafana/ui';

export enum GraphType {
  Timeseries = 'timeseries',
  XYPlot = 'xy',
}

export interface XYPlotConfig {
  // Dimensions -- NOTE either X or Y must match a single value
  xFields?: MatcherConfig; // Field Matchers
  yFields?: MatcherConfig;
}

export const defaultXYPlotConfig: XYPlotConfig = {
  xFields: {
    id: FieldMatcherID.first,
  },
  yFields: {
    id: FieldMatcherID.numeric,
  },
};

export interface GraphOptions {
  type?: GraphType; // defaults to timeseries
  xy?: XYPlotConfig;

  legend: LegendOptions;
  tooltipOptions: GraphTooltipOptions;
}

export interface GraphLegendEditorLegendOptions extends LegendOptions {
  stats?: string[];
  decimals?: number;
  sortBy?: string;
  sortDesc?: boolean;
}
