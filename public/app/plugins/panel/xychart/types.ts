import { OptionsWithTooltip, OptionsWithLegend } from '@grafana/schema';
import { DataFrame, Field } from '@grafana/data';
import {
  ColorDimensionConfig,
  DimensionSupplier,
  TextDimensionConfig,
  ScaleDimensionConfig,
} from 'app/features/dimensions';
export interface XYDimensionConfig {
  frame: number;
  x?: string; // name | first
  exclude?: string[]; // all other numbers except
}

// Runtime processed type send to render
export interface ScatterSeries {
  style?: 'line' | 'points' | '...';

  color: DimensionSupplier<string>; // marker color?
  size?: DimensionSupplier<number>;
  label?: DimensionSupplier<string>;

  symbol?: DimensionSupplier<string>; // point color?

  x?: Field;
  y?: Field;

  frame: DataFrame;
  name: string;
}

export interface SeriesConfig {
  x: string;
  y: string;

  size?: ScaleDimensionConfig;
  color?: ColorDimensionConfig;
  label?: TextDimensionConfig;
}

export interface Options extends OptionsWithLegend, OptionsWithTooltip {
  dims: XYDimensionConfig;

  // Flag to trigger new behavior
  mode?: 'xy' | 'scatter';

  // Single series for now (should be an array)
  series: SeriesConfig; // TODO array?  config per series? refId?
}
