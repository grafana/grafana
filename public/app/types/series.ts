namespace Series {
  // [Value, Timestamp]
  export type Datapoint = [number, number];

  export interface SeriesData {
    datapoints: Datapoint[];
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

  export type NullPointMode = 'null' | 'connected' | 'null as zero' | null;
}
