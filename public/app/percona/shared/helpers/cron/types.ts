export type PeriodType = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute';

export type CronType = 'period' | 'months' | 'month-days' | 'week-days' | 'hours' | 'minutes';

export interface Unit {
  type: CronType;
  min: number;
  max: number;
  total: number;
  alt?: string[];
}

export type LeadingZeroType = 'month-days' | 'hours' | 'minutes';
export type LeadingZero = boolean | LeadingZeroType[];
export type ClockFormat = '24-hour-clock' | '12-hour-clock';
