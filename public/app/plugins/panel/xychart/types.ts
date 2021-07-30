import { OptionsWithTooltip, OptionsWithLegend } from '@grafana/ui';
import { DataFrame, Field } from '../../../../../packages/grafana-data/src';
import {
  ColorDimensionConfig,
  DimensionSupplier,
  LabelDimensionConfig,
  ScaleDimensionConfig,
} from '../geomap/dims/types';
export interface XYDimensionConfig {
  frame: number;
  x?: string; // name | first
  exclude?: string[]; // all other numbers except
}

// Runtime processed type send to render
export interface ScatterTrace {
  style?: 'line' | 'points' | '...';

  color: DimensionSupplier<string>; // point color?
  size?: DimensionSupplier<number>;
  label?: DimensionSupplier<string>;

  symbol?: DimensionSupplier<string>; // point color?

  x?: Field;
  y?: Field;

  frame: DataFrame;
  name: string;
}

export interface TraceConfig {
  x: string;
  y: string;

  size?: ScaleDimensionConfig;
  color?: ColorDimensionConfig;
  label?: LabelDimensionConfig;
}

export interface Options extends OptionsWithLegend, OptionsWithTooltip {
  dims: XYDimensionConfig;

  // Flag to trigger new behavior
  mode?: 'xy' | 'scatter';

  // Single trace for now (should be an array)
  trace: TraceConfig;
}
