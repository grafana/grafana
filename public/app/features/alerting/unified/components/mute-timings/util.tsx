import { MuteTimeInterval } from "app/plugins/datasource/alertmanager/types";
import moment from "moment";
import React from "react";
import { getDaysOfMonthString, getMonthsString, getTimeString, getWeekdayString, getYearsString } from "../../utils/alertmanager";

function summarizeMuteTiming(muteTiming: MuteTimeInterval): JSX.Element {
  const numIntervals = muteTiming.time_intervals.length;

  // TODO can we calculate the next occurrence of the mute timing?
  const nextOccurrences = [];

  const intervals = muteTiming.time_intervals.map(interval => {
    const start = null;
    const end = null;

    return {
      start,
      end
    }
  });

  // Every <day of week> <day of month> of <month> in <year> from <start> to <end>

  return (
    <>
    </>
  )
}

// https://github.com/prometheus/alertmanager/blob/9de8ef36755298a68b6ab20244d4369d38bdea99/timeinterval/timeinterval.go#L443
const TIME_RANGE_REGEX = /^((([01][0-9])|(2[0-3])):[0-5][0-9])$|(^24:00$)/

const isvalidTimeFormat = (timeString: string): boolean => {
  return timeString ? TIME_RANGE_REGEX.test(timeString) : true;
};

const isValidStartAndEndTime = (startTime?: string, endTime?: string): boolean => {
  // empty time range is perfactly valid for a mute timing
  if (!startTime && !endTime) {
    return true
  }

  if ((!startTime && endTime) || startTime && !endTime) {
    return false
  }

  const startDate = moment().startOf('day').add(startTime, "HH:mm");
  const endDate = moment().startOf('day').add(endTime, "HH:mm");

  if (startTime && endTime && startDate.isBefore(endDate)) {
    return true
  }

  if (startTime && endTime && endDate.isAfter(startDate)) {
    return true
  }

  return false
}

function renderTimeIntervals(muteTiming: MuteTimeInterval) {
  const timeIntervals = muteTiming.time_intervals;

  return timeIntervals.map((interval, index) => {
    const { times, weekdays, days_of_month, months, years } = interval;
    const timeString = getTimeString(times);
    const weekdayString = getWeekdayString(weekdays);
    const daysString = getDaysOfMonthString(days_of_month);
    const monthsString = getMonthsString(months);
    const yearsString = getYearsString(years);

    return (
      <React.Fragment key={JSON.stringify(interval) + index}>
        {`${timeString} ${weekdayString}`}
        <br />
        {[daysString, monthsString, yearsString].join(' | ')}
        <br />
      </React.Fragment>
    );
  });
}

export {
  isvalidTimeFormat,
  isValidStartAndEndTime,
  renderTimeIntervals,
  summarizeMuteTiming
};
