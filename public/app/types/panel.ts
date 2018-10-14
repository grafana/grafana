import { LoadingState, TimeSeries } from './series';

export interface PanelProps {
  timeSeries: TimeSeries[];
  loading: LoadingState;
}
