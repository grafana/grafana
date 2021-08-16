import { ColorDimensionConfig, ResourceDimensionConfig } from 'app/features/dimensions/types';

export interface Placement {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;

  width?: number;
  height?: number;
}

export interface Anchor {
  top?: boolean;
  left?: boolean;
  right?: boolean;
  bottom?: boolean;
}

export enum BackroundImageSize {
  Fit = 'fit',
  Original = 'original',
  Strech = 'strech',
  Tile = 'tile',
}

export interface BackgroundConfig {
  color?: ColorDimensionConfig;
  image?: ResourceDimensionConfig;
  size?: BackroundImageSize;
}

export interface LineConfig {
  color?: ColorDimensionConfig;
  width?: number;
}
