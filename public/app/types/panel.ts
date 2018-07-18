namespace Panel {
  export interface PanelOptions {
    links?: any[];
  }

  export interface MetricPanelOptions extends PanelOptions {
    datasource?: any;
    maxDataPoints?: number;
    interval?: any;
    targets?: any[];
    cacheTimeout?: any;
  }

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
}
