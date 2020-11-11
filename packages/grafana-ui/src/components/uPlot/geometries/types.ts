import { TimeZone } from '@grafana/data';
import { AxisSide } from '../types';

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
  side?: AxisSide;
  grid?: boolean;
  formatValue?: (v: any) => string;
  values?: any;
  isTime?: boolean;
  timeZone?: TimeZone;
}

export interface ScaleProps {
  scaleKey: string;
  isTime?: boolean;
}
