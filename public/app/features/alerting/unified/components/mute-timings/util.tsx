import { Fragment } from 'react';

import { Stack } from '@grafana/ui';
import { type AlertmanagerConfig, type MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

import {
  getDaysOfMonthString,
  getMonthsString,
  getTimeString,
  getWeekdayString,
  getYearsString,
} from '../../utils/alertmanager';

// https://github.com/prometheus/alertmanager/blob/9de8ef36755298a68b6ab20244d4369d38bdea99/timeinterval/timeinterval.go#L443
const TIME_RANGE_REGEX = /^((([01][0-9])|(2[0-3])):[0-5][0-9])$|(^24:00$)/;

export const isvalidTimeFormat = (timeString: string): boolean => {
  return timeString ? TIME_RANGE_REGEX.test(timeString) : true;
};

/**
 * Merges `mute_time_intervals` and `time_intervals` from alertmanager config to support both old and new config
 */
export const mergeTimeIntervals = (alertManagerConfig: AlertmanagerConfig) => {
  return [...(alertManagerConfig.mute_time_intervals ?? []), ...(alertManagerConfig.time_intervals ?? [])];
};

export const isValidStartAndEndTime = (startTime?: string, endTime?: string): boolean => {
  // empty time range is perfactly valid for a mute timing
  if (!startTime && !endTime) {
    return true;
  }

  if (!startTime || !endTime) {
    return false;
  }

  return minutesSinceMidnight(startTime) < minutesSinceMidnight(endTime);
};

// "HH:mm" clock string to minutes since midnight; NaN (which never compares true) for malformed input
const minutesSinceMidnight = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export function renderTimeIntervals(muteTiming: MuteTimeInterval) {
  const timeIntervals = muteTiming.time_intervals;

  const intervals = timeIntervals.map((interval, index) => {
    const { times, weekdays, days_of_month, months, years, location } = interval;
    const timeString = getTimeString(times, location);
    const weekdayString = getWeekdayString(weekdays);
    const daysString = getDaysOfMonthString(days_of_month);
    const monthsString = getMonthsString(months);
    const yearsString = getYearsString(years);

    return (
      <Fragment key={JSON.stringify(interval) + index}>
        <div>
          {`${timeString} ${weekdayString}`}
          <br />
          {[daysString, monthsString, yearsString].join(' | ')}
          <br />
        </div>
      </Fragment>
    );
  });

  return (
    <Stack direction="column" gap={1}>
      {intervals}
    </Stack>
  );
}
