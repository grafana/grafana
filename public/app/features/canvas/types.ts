import { LinkModel } from '@grafana/data/src';
import { ColorDimensionConfig, ResourceDimensionConfig, TextDimensionConfig } from 'app/features/dimensions/types';

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

export interface TextData {
  text?: string;
  color?: string;
  size?: number; // 0 or missing will "auto size"
  align: Align;
  valign: VAlign;
  links?: LinkModel[];
}

export interface TextConfig {
  text?: TextDimensionConfig;
  color?: ColorDimensionConfig;
  size?: number; // 0 or missing will "auto size"
  align: Align;
  valign: VAlign;
}
