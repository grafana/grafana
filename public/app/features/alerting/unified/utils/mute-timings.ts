import { isUndefined, omitBy } from 'lodash';

import { MuteTimeInterval, TimeInterval, TimeRange } from 'app/plugins/datasource/alertmanager/types';

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
  disable: false,
};

export const validateArrayField = (
  value: string | undefined,
  validateValue: (input: string) => boolean,
  invalidText: string
) => {
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

const convertStringToArray = (str?: string) => {
  return str ? str.split(',').map((s) => s.trim()) : undefined;
};

export const createMuteTiming = (fields: MuteTimingFields): MuteTimeInterval => {
  const timeIntervals: TimeInterval[] = fields.time_intervals.map(
    ({ times, weekdays, days_of_month, months, years, location, disable }) => {
      const interval = {
        times: convertTimesToDto(times, disable),
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

/*
 * Convert times from form to dto, if disable is true, then return an empty array as times
 If the times array is empty and disable is false, then return undefined
 * @param muteTimeInterval
 * @returns MuteTimingFields
 *
 */
function convertTimesToDto(times: TimeRange[] | undefined, disable: boolean) {
  if (disable) {
    return [];
  }
  const timesToReturn = times?.filter(({ start_time, end_time }) => !!start_time && !!end_time);
  return timesToReturn?.length ? timesToReturn : undefined;
}

/*
 * Get disable field from dto, if any of the lists is an empty array, then the disable field is true
 * @param muteTimeInterval
 * @returns MuteTimingFields
 *
 */

export function getDisabledFromDto(intervals: TimeInterval): boolean {
  if (
    intervals.times?.length === 0 ||
    intervals.weekdays?.length === 0 ||
    intervals.days_of_month?.length === 0 ||
    intervals.months?.length === 0 ||
    intervals.years?.length === 0
  ) {
    return true;
  }
  return false;
}
