import { GrafanaTheme, TimeZone } from '@grafana/data';
import { AxisSide } from '../types';

export interface SeriesProps {
  scaleKey: string;
  line?: boolean;
  lineColor?: string;
  lineWidth?: number;
  points?: boolean;
  pointSize?: number;
  pointColor?: string;
  fill?: boolean;
  fillOpacity?: number;
  fillColor?: string;
}

export interface AxisProps {
  scaleKey: string;
  theme: GrafanaTheme;
  label?: string;
  stroke?: string;
  show?: boolean;
  size?: number;
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
