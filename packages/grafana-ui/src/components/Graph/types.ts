export interface FlotPosition {
  pageX: number;
  pageY: number;
  x: number;
  x1: number;
  y: number;
  y1: number;
}

export interface FlotItem {
  datapoint: [number, number];
  dataIndex: number;
  series: {
    points: any;
    lines: any;
    bars: any;
    data: Array<[number, number]>;
    seriesIndex: number;
    label: string;
    color: string;
    isVisble: boolean;
  };
  seriesIndex: number;
  pageX: number;
  pageY: number;
}
