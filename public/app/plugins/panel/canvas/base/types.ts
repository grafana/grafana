import { ColorDimensionConfig } from 'app/features/dimensions/types';

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

export interface BackgroundConfig {
  color?: ColorDimensionConfig;
  image?: string;
  // repeat // https://developer.mozilla.org/en-US/docs/Web/CSS/background-repeat
  // position ?
}

export interface LineConfig {
  color?: ColorDimensionConfig;
  width?: number;
}
