import { LinkModel } from '@grafana/data';
import { ColorDimensionConfig, ResourceDimensionConfig, TextDimensionConfig } from '@grafana/schema';
import { BackgroundImageSize } from 'app/plugins/panel/canvas/panelcfg.gen';

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
  field?: string;
}

export interface TextConfig {
  text?: TextDimensionConfig;
  color?: ColorDimensionConfig;
  size?: number; // 0 or missing will "auto size"
  align: Align;
  valign: VAlign;
}

export interface CanvasElementConfig extends TextConfig {
  backgroundColor?: ColorDimensionConfig;
  backgroundImage?: ResourceDimensionConfig;
  backgroundSize?: BackgroundImageSize;
  borderColor?: ColorDimensionConfig;
  borderWidth?: number;
}

export interface CanvasElementData extends TextData {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface StandardEditorConfig {
  layout?: boolean;
  background?: boolean;
  border?: boolean;
}
