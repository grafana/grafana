export interface LineProps {
  scaleKey: string;
  stroke: string;
  width: number;
}

export interface PointProps {
  scaleKey: string;
  size: number;
  stroke: string;
}

export interface AreaProps {
  scaleKey: string;
  fill: number;
  color: string;
}

export interface AxisProps {
  scaleKey: string;
  label?: string;
  show?: boolean;
  size?: number;
  stroke?: string;
  side?: number;
  grid?: boolean;
  formatValue?: (v: any) => string;
  values?: any;
}

export interface ScaleProps {
  scaleKey: string;
  time?: boolean;
}
