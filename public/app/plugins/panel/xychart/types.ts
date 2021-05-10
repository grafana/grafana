import { VizTooltipOptions } from '@grafana/ui';
import { OptionsWithLegend } from 'app/features/panel/options/legend';

export interface XYDimensionConfig {
  frame: number;
  x?: string; // name | first
  exclude?: string[]; // all other numbers except
}

export interface Options extends OptionsWithLegend {
  dims: XYDimensionConfig;
  tooltipOptions: VizTooltipOptions;
}
