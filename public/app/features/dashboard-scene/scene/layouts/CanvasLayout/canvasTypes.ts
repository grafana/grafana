export interface Constraint {
  horizontal?: HorizontalConstraint;
  vertical?: VerticalConstraint;
}

export enum HorizontalConstraint {
  Left = 'left',
  Right = 'right',
  LeftRight = 'leftright',
  Center = 'center',
  Scale = 'scale',
}

export enum VerticalConstraint {
  Top = 'top',
  Bottom = 'bottom',
  TopBottom = 'topbottom',
  Center = 'center',
  Scale = 'scale',
}

export enum BackgroundImageSize {
  Original = 'original',
  Contain = 'contain',
  Cover = 'cover',
  Fill = 'fill',
  Tile = 'tile',
}

export interface BackgroundConfig {
  color?: string; //ColorDimensionConfig
  image?: string; //ResourceDimensionConfig
  size?: BackgroundImageSize;
}

export enum Align {
  Left = 'left',
  Center = 'center',
  Right = 'right',
}

export enum VAlign {
  Top = 'top',
  Middle = 'middle',
  Bottom = 'bottom',
}

export interface LineConfig {
  color?: string; //ColorDimensionConfig
  width?: number;
}

export interface CanvasElementPlacement {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  height?: number;
  width?: number;
  horizontal?: HorizontalConstraint;
  vertical?: VerticalConstraint;
}
