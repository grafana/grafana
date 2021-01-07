import { FieldMatcherID, MatcherConfig } from '@grafana/data';
import { LegendOptions, GraphTooltipOptions } from '@grafana/ui';

export const defaultXYDimensions: XYDimensions = {
  frame: 0,
  xFields: {
    id: FieldMatcherID.first,
  },
  yFields: {
    id: FieldMatcherID.numeric,
  },
};

export interface XYDimensions {
  frame?: number;
  xFields?: MatcherConfig; // Field Matchers
  yFields?: MatcherConfig;
}

export interface GraphOptions {
  dims: XYDimensions;
}

export interface Options {
  graph: GraphOptions;
  legend: LegendOptions;
  tooltipOptions: GraphTooltipOptions;
}
