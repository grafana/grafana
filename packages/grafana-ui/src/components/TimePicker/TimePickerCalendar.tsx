import React, { PureComponent } from 'react';
import Calendar from 'react-calendar/dist/entry.nostyle';
import moment, { Moment } from 'moment';
import { TimeFragment } from '../../types/time';
import { stringToMoment } from '../../utils/time';

export interface Props {
  value: TimeFragment;
  isTimezoneUtc: boolean;
  roundup?: boolean;
  timezone?: string;
  onChange: (value: Moment) => void;
}

export class TimePickerCalendar extends PureComponent<Props> {
  onCalendarChange = (date: Date) => {
    const { onChange } = this.props;

    onChange(moment(date));
  };

  render() {
    const { value, isTimezoneUtc, roundup, timezone } = this.props;
    const dateValue = moment.isMoment(value)
      ? value.toDate()
      : stringToMoment(value, isTimezoneUtc, roundup, timezone).toDate();
    const calendarValue = dateValue instanceof Date && !isNaN(dateValue.getTime()) ? dateValue : moment().toDate();

    return (
      <Calendar
        value={calendarValue}
        next2Label={null}
        prev2Label={null}
        className={'time-picker-calendar'}
        tileClassName={'time-picker-calendar-tile'}
        onChange={this.onCalendarChange}
      />
    );
  }
}
