import {
  OptionsWithTooltip,
  OptionsWithLegend,
  LineStyle,
  VisibilityMode,
  HideableFieldConfig,
  AxisConfig,
  AxisPlacement,
} from '@grafana/schema';
import {
  ColorDimensionConfig,
  DimensionSupplier,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';

export enum ScatterLineMode {
  None = 'none',
  Linear = 'linear',
  // Smooth
  // r2, etc
}

export interface ScatterFieldConfig extends HideableFieldConfig, AxisConfig {
  line?: ScatterLineMode;
  lineWidth?: number;
  lineStyle?: LineStyle;
  lineColor?: ColorDimensionConfig;

  point?: VisibilityMode;
  pointSize?: ScaleDimensionConfig; // only 'fixed' is exposed in the UI
  pointColor?: ColorDimensionConfig;
  pointSymbol?: DimensionSupplier<string>;

  label?: VisibilityMode;
  labelValue?: TextDimensionConfig;
}

/** Configured in the panel level */
export interface ScatterSeriesConfig extends ScatterFieldConfig {
  x?: string;
  y?: string;
  name?: string;
}

export const defaultScatterConfig: ScatterFieldConfig = {
  line: ScatterLineMode.None, // no line
  lineWidth: 1,
  lineStyle: {
    fill: 'solid',
  },
  point: VisibilityMode.Auto,
  pointSize: {
    fixed: 5,
    min: 1,
    max: 20,
  },
  axisPlacement: AxisPlacement.Auto,
};

/** Old config saved with 8.0+ */
export interface XYDimensionConfig {
  frame: number;
  x?: string; // name | first
  exclude?: string[]; // all other numbers except
}

export interface XYChartOptions extends OptionsWithLegend, OptionsWithTooltip {
  mode?: 'auto' | 'manual';
  dims: XYDimensionConfig;

  series?: ScatterSeriesConfig[];
}
