import React, { PureComponent } from 'react';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { TimeRange } from '../../types/time';

export enum CalendarType {
  From,
  To,
}

export interface Props {
  calendarType: CalendarType;
  value: TimeRange;
}

export class TimePickerCalendar extends PureComponent<Props> {
  render() {
    const { calendarType, value } = this.props;
    const activeStartDate = calendarType === CalendarType.From ? value.from.toDate() : value.to.toDate();

    return (
      <Calendar
        activeStartDate={activeStartDate}
        next2Label={null}
        prev2Label={null}
        className={'time-picker-calendar'}
        tileClassName={'time-picker-calendar-tile'}
      />
    );
  }
}
