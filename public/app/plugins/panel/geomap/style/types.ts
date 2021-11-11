import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import { Style } from 'ol/style';

// StyleConfig is saved in panel json and is used to configure how items get rendered
export interface StyleConfig {
  color?: ColorDimensionConfig;
  opacity?: number; // defaults to 80%

  // For non-points
  stroke?: number;

  // Used for points
  size?: ScaleDimensionConfig;
  symbol?: ResourceDimensionConfig;

  // when labels are shown
  text?: TextDimensionConfig;
  offset?: [number, number];
}

// Applying the config to real data gives the values
export interface StyleConfigValues {
  fillColor: string;
  lineColor?: string;
  lineWidth?: number;
  size?: number;
  symbol?: string; // the point symbol
  text?: string;
  rotation?: number;
  offset?: [number, number];
}

/**
 * Given values create a style
 */
export type StyleMaker = (values: StyleConfigValues) => Style | Style[];
