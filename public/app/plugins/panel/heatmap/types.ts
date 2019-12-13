export interface Bucket {
  [x: string]: {
    y: any;
    bounds: any;
    values: any[];
    points?: any[];
    count: number;
  };
}

export interface XBucket {
  x: number;
  buckets: any;
}

export interface YBucket {
  y: number;
  values: number[];
}

export interface HeatmapCard {
  x: number;
  y: number;
  yBounds: {
    top: number | null;
    bottom: number | null;
  };
  values: number[];
  count: number;
}

export interface HeatmapCardStats {
  min: number;
  max: number;
}

export interface HeatmapData {
  [key: string]: {
    x: number;
    buckets: Bucket;
  };
}
