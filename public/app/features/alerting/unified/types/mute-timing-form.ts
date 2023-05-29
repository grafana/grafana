import { TimeRange } from 'app/plugins/datasource/alertmanager/types';

export type MuteTimingFields = {
  name: string;
  time_intervals: MuteTimingIntervalFields[];
};

export type MuteTimingIntervalFields = {
  times: TimeRange[];
  weekdays: string;
  days_of_month: string;
  months: string;
  years: string;
  location?: string;
};
