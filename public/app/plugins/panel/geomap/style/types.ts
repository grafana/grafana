import { Style } from 'ol/style';

import {
  ColorDimensionConfig,
  DimensionSupplier,
  ResourceDimensionConfig,
  ResourceDimensionMode,
  ScaleDimensionConfig,
  ScalarDimensionConfig,
  ScalarDimensionMode,
  TextDimensionConfig,
} from 'app/features/dimensions';

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

  // Allow for rotation of markers
  rotation?: ScalarDimensionConfig;
}

export const DEFAULT_SIZE = 5;

export enum TextAlignment {
  Left = 'left',
  Center = 'center',
  Right = 'right',
}
export enum TextBaseline {
  Top = 'top',
  Middle = 'middle',
  Bottom = 'bottom',
}

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
  textConfig: {
    fontSize: 12,
    textAlign: TextAlignment.Center,
    textBaseline: TextBaseline.Middle,
    offsetX: 0,
    offsetY: 0,
  },
  rotation: {
    fixed: 0,
    mode: ScalarDimensionMode.Mod,
    min: -360,
    max: 360,
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
  textAlign?: TextAlignment;
  textBaseline?: TextBaseline;
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

/** When the style depends on a field */
export interface StyleConfigFields {
  color?: string;
  size?: string;
  text?: string;
  rotation?: string;
}

export interface StyleDimensions {
  color?: DimensionSupplier<string>;
  size?: DimensionSupplier<number>;
  text?: DimensionSupplier<string>;
  rotation?: DimensionSupplier<number>;
}

export interface StyleConfigState {
  config: StyleConfig;
  hasText?: boolean;
  base: StyleConfigValues;
  fields?: StyleConfigFields;
  dims?: StyleDimensions;
  maker: StyleMaker;
}

/**
 * Given values create a style
 */
export type StyleMaker = (values: StyleConfigValues) => Style | Style[];
