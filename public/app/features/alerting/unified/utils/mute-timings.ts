import { omitBy, isUndefined } from 'lodash';

import { MuteTimeInterval, TimeInterval } from 'app/plugins/datasource/alertmanager/types';

import { MuteTimingFields, MuteTimingIntervalFields } from '../types/mute-timing-form';

export const DAYS_OF_THE_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export const defaultTimeInterval: MuteTimingIntervalFields = {
  times: [{ start_time: '', end_time: '' }],
  weekdays: '',
  days_of_month: '',
  months: '',
  years: '',
  location: '',
};

export const validateArrayField = (value: string, validateValue: (input: string) => boolean, invalidText: string) => {
  if (value) {
    return (
      value
        .split(',')
        .map((x) => x.trim())
        .every((entry) => entry.split(':').every(validateValue)) || invalidText
    );
  } else {
    return true;
  }
};

const convertStringToArray = (str: string) => {
  return str ? str.split(',').map((s) => s.trim()) : undefined;
};

export const createMuteTiming = (fields: MuteTimingFields): MuteTimeInterval => {
  const timeIntervals: TimeInterval[] = fields.time_intervals.map(
    ({ times, weekdays, days_of_month, months, years, location }) => {
      const interval = {
        times: times.filter(({ start_time, end_time }) => !!start_time && !!end_time),
        weekdays: convertStringToArray(weekdays)?.map((v) => v.toLowerCase()),
        days_of_month: convertStringToArray(days_of_month),
        months: convertStringToArray(months),
        years: convertStringToArray(years),
        location: location ? location : undefined,
      };

      return omitBy(interval, isUndefined);
    }
  );

  return {
    name: fields.name,
    time_intervals: timeIntervals,
  };
};
