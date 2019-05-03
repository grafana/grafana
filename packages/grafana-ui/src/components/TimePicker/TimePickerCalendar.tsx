import React, { PureComponent } from 'react';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { TimeFragment } from '../../types/time';
import { Timezone } from '../../utils/datemath';

import { stringToDateTimeType } from './time';
import { DateTimeType, momentWrapper, isDateTimeType } from 'app/core/moment_wrapper';

export interface Props {
  value: TimeFragment;
  isTimezoneUtc: boolean;
  roundup?: boolean;
  timezone?: Timezone;
  onChange: (value: DateTimeType) => void;
}

export class TimePickerCalendar extends PureComponent<Props> {
  onCalendarChange = (date: Date | Date[]) => {
    const { onChange } = this.props;

    if (Array.isArray(date)) {
      return;
    }

    onChange(momentWrapper(date));
  };

  render() {
    const { value, isTimezoneUtc, roundup, timezone } = this.props;
    const dateValue = isDateTimeType(value)
      ? value.toDate()
      : stringToDateTimeType(value, isTimezoneUtc, roundup, timezone).toDate();
    const calendarValue =
      dateValue instanceof Date && !isNaN(dateValue.getTime()) ? dateValue : momentWrapper().toDate();

    return (
      <Calendar
        value={calendarValue}
        next2Label={null}
        prev2Label={null}
        className="time-picker-calendar"
        tileClassName="time-picker-calendar-tile"
        onChange={this.onCalendarChange}
      />
    );
  }
}
