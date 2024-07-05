import moment from 'moment';
import { Fragment } from 'react';

import { config } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AlertmanagerConfig, MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

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

  if ((!startTime && endTime) || (startTime && !endTime)) {
    return false;
  }

  const timeUnit = 'HH:mm';
  // @ts-ignore typescript types here incorrect, sigh
  const startDate = moment().startOf('day').add(startTime, timeUnit);
  // @ts-ignore typescript types here incorrect, sigh
  const endDate = moment().startOf('day').add(endTime, timeUnit);

  if (startTime && endTime && startDate.isBefore(endDate)) {
    return true;
  }

  if (startTime && endTime && endDate.isAfter(startDate)) {
    return true;
  }

  return false;
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

/**
 * Get the correct namespace to use when using the K8S API.
 *
 * If the user is in org 1, the namespace should be `default`,
 * as the K8S API has a special case for this
 */
export const getNamespace = () => {
  const { orgId } = contextSrv.user;
  const isOrg1 = orgId === 1;
  return isOrg1 ? 'default' : `org-${String(orgId)}`;
};

/**
 * Should we call the kubernetes-style API for managing the time intervals?
 *
 * Requires the alertmanager referenced being the Grafana AM,
 * and the `alertingApiServer` feature toggle being enabled
 */
export const shouldUseK8sApi = (alertmanager?: string) => {
  const featureToggleEnabled = config.featureToggles.alertingApiServer;
  return featureToggleEnabled && alertmanager === GRAFANA_RULES_SOURCE_NAME;
};
