import { Moment } from 'moment';

export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Done = 'Done',
  Error = 'Error',
}

export interface RawTimeRange {
  from: Moment | string;
  to: Moment | string;
}

export interface TimeRange {
  from: Moment;
  to: Moment;
  raw: RawTimeRange;
}
