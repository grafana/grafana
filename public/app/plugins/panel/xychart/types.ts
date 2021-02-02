import { GraphTooltipOptions } from '@grafana/ui';
import { OptionsWithLegend } from '../timeseries/types';

export interface XYDimensionConfig {
  frame: number;
  x?: string; // name | first
  exclude?: string[]; // all other numbers except
}

export interface Options extends OptionsWithLegend {
  dims: XYDimensionConfig;
  tooltipOptions: GraphTooltipOptions;
}
