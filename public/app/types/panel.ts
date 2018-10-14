import { LoadingState, TimeSeries, TimeRange } from './series';

export interface PanelProps {
  timeSeries: TimeSeries[];
  timeRange: TimeRange;
  loading: LoadingState;
}
