import React, { PureComponent } from 'react';
import Calendar from 'react-calendar/dist/entry.nostyle';

export enum CalendarType {
  From,
  To,
}

export interface Props {
  calendar?: CalendarType;
  value?: string;
}

export class TimePickerCalendar extends PureComponent<Props> {
  render() {
    return (
      <Calendar
        next2Label={null}
        prev2Label={null}
        className={'time-picker-calendar'}
        tileClassName={'time-picker-calendar-tile'}
      />
    );
  }
}
