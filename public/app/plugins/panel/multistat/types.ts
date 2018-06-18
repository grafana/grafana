export interface IStat {
  alias?: string;
  label?: string;
  value: number;
  valueRounded: number;
  valueFormatted: string;
  flotpairs: any[];
  scopedVars?: any;
}

export interface ISize {
  w: number;
  h: number;
}

export interface PanelBase {
  links: any[];
  datasource: any;
  maxDataPoints: number;
  interval: any;
  targets: any[];
  cacheTimeout: any;
}

export interface Panel extends PanelBase {
  layout: Layout;
  format: any;
  mappingType: any;
  nullPointMode: any;
  valueName: any;
  thresholds: any;
  colorBackground: any;
  colorValue: any;
  colors: any;
  sparkline: any;
}

export enum Layout {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}
