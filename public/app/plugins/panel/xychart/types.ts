import { OptionsWithTooltip, OptionsWithLegend, OptionsWithGridLines } from '@grafana/schema';
export interface XYDimensionConfig {
  frame: number;
  x?: string; // name | first
  exclude?: string[]; // all other numbers except
}

export interface Options extends OptionsWithLegend, OptionsWithTooltip, OptionsWithGridLines {
  dims: XYDimensionConfig;
}
