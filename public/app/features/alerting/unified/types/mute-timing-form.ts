export type MuteTimingFields = {
  name: string;
  time_intervals: MuteTimingIntervalFields[];
};

export type MuteTimingIntervalFields = {
  times: Array<{
    start_time: string;
    end_time: string;
  }>;
  weekdays: string;
  days_of_month: string;
  months: string;
  years: string;
};
