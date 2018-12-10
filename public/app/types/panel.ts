import { LoadingState, TimeSeries, TimeRange } from './series';

export interface PanelProps<T = any> {
  timeSeries: TimeSeries[];
  timeRange: TimeRange;
  loading: LoadingState;
  options: T;
  renderCounter: number;
  width: number;
  height: number;
}

export interface PanelOptionsProps<T = any> {
  options: T;
  onChange: (options: T) => void;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelMenuItem {
  type?: 'submenu' | 'divider';
  text?: string;
  iconClassName?: string;
  onClick?: () => void;
  shortcut?: string;
  subMenu?: PanelMenuItem[];
}

export interface Threshold {
  index: number;
  label: string;
  value: number;
  color?: string;
  canRemove: boolean;
}

export enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

interface BaseMap {
  op: string;
  text: string;
  type: MappingType;
}

export interface ValueMap extends BaseMap {
  value: string;
}

export interface RangeMap extends BaseMap {
  from: string;
  to: string;
}
