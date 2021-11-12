import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ResourceDimensionMode,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import { Style } from 'ol/style';

export enum GeometryTypeId {
  Point = 'point',
  Line = 'line',
  Polygon = 'polygon',
  Any = '*any*',
}

// StyleConfig is saved in panel json and is used to configure how items get rendered
export interface StyleConfig {
  color?: ColorDimensionConfig;
  opacity?: number; // defaults to 80%

  // For non-points
  lineWidth?: number;

  // Used for points and dynamic text
  size?: ScaleDimensionConfig;
  symbol?: ResourceDimensionConfig;

  // Can show markers and text together!
  text?: TextDimensionConfig;
  textConfig?: TextStyleConfig;
}

export const DEFAULT_SIZE = 5;

export const defaultStyleConfig = Object.freeze({
  size: {
    fixed: DEFAULT_SIZE,
    min: 2,
    max: 15,
  },
  color: {
    fixed: 'dark-green', // picked from theme
  },
  opacity: 0.4,
  symbol: {
    mode: ResourceDimensionMode.Fixed,
    fixed: 'img/icons/marker/circle.svg',
  },
});

/**
 * Static options for text display.  See:
 * https://openlayers.org/en/latest/apidoc/module-ol_style_Text.html
 */
export interface TextStyleConfig {
  fontSize?: number;
  offsetX?: number;
  offsetY?: number;
  align?: 'left' | 'right' | 'center';
  baseline?: 'bottom' | 'top' | 'middle';
}

// Applying the config to real data gives the values
export interface StyleConfigValues {
  color: string;
  opacity?: number;
  lineWidth?: number;
  size?: number;
  symbol?: string; // the point symbol
  rotation?: number;
  text?: string;

  // Pass though (not value dependant)
  textConfig?: TextStyleConfig;
}

/**
 * Given values create a style
 */
export type StyleMaker = (values: StyleConfigValues) => Style | Style[];
