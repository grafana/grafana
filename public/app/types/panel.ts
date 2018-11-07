import { LoadingState, TimeSeries, TimeRange } from './series';

export interface PanelProps<T = any> {
  timeSeries: TimeSeries[];
  timeRange: TimeRange;
  loading: LoadingState;
  options: T;
  renderCounter: number;
}

export interface PanelOptionsProps<T = any> {
  options: T;
  onChange: (options: T) => void;
}
