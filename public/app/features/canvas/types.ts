import { ColorDimensionConfig, ResourceDimensionConfig } from 'app/features/dimensions/types';

export interface Placement {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;

  width?: number;
  height?: number;
}

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
  color?: ColorDimensionConfig;
  image?: ResourceDimensionConfig;
  size?: BackgroundImageSize;
}

export interface LineConfig {
  color?: ColorDimensionConfig;
  width?: number;
}

export enum QuickPlacement {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right',
  HorizontalCenter = 'hcenter',
  VerticalCenter = 'vcenter',
}
