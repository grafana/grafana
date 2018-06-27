import { PanelModel } from 'app/features/dashboard/panel_model';
import { ThresholdModel } from './components/ThresholdManager/ThresholdEditor';

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
  prefixFontSize?: string;
  valueFontSize?: string;
  postfixFontSize?: string;
  colorBackground?: any;
  colorValue?: any;
  sparkline?: any;
  thresholds?: ThresholdModel[];
}

export type MultistatPanelModel = PanelModel & MultistatPanelOptions;

export enum MultistatPanelLayout {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}
