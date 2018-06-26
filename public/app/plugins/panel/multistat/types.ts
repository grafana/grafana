import { PanelModel } from 'app/features/dashboard/panel_model';

export interface SeriesData {
  datapoints: any[];
  target: string;
}

export type DataList = SeriesData[];

export interface SeriesStat {
  alias?: string;
  label?: string;
  value?: number;
  valueRounded?: number;
  valueFormatted?: string;
  flotpairs?: any[];
  scopedVars?: any;
}

export interface MultistatPanelSize {
  w: number;
  h: number;
}

export interface BasePanelOptions {
  links?: any[];
}

export interface MetricPanelOptions extends BasePanelOptions {
  datasource?: any;
  maxDataPoints?: number;
  interval?: any;
  targets?: any[];
  cacheTimeout?: any;
}

export interface MultistatPanelOptions extends MetricPanelOptions {
  layout?: MultistatPanelLayout;
  format?: any;
  mappingType?: any;
  nullPointMode?: any;
  valueName?: string;
  thresholds?: any;
  colorBackground?: any;
  colorValue?: any;
  colors?: any;
  sparkline?: any;
}

export type MultistatPanelModel = PanelModel & MultistatPanelOptions;

export enum MultistatPanelLayout {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}
