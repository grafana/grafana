import React, { PureComponent } from 'react';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { TimeFragment, TimeZone, TIME_FORMAT } from '../../types/time';
import { DateTime, dateTime, toUtc } from '../../utils/moment_wrapper';
import { stringToDateTimeType } from './time';

export interface Props {
  value: TimeFragment;
  roundup?: boolean;
  timeZone?: TimeZone;
  onChange: (value: DateTime) => void;
}

export class TimePickerCalendar extends PureComponent<Props> {
  onCalendarChange = (date: Date | Date[]) => {
    const { onChange, timeZone } = this.props;

    if (Array.isArray(date)) {
      return;
    }

    let newDate = dateTime(date);

    if (timeZone === 'utc') {
      newDate = toUtc(newDate.format(TIME_FORMAT));
    }

    onChange(newDate);
  };

  onDrilldown = (props: any) => {
    // this is to prevent clickout side wrapper from triggering when drilling down
    if (window.event) {
      // @ts-ignore
      window.event.stopPropagation();
    }
  };

  render() {
    const { value, roundup, timeZone } = this.props;
    let date = stringToDateTimeType(value, roundup, timeZone);

    if (!date.isValid()) {
      date = dateTime();
    }

    return (
      <Calendar
        value={date.toDate()}
        next2Label={null}
        prev2Label={null}
        className="time-picker-calendar"
        tileClassName="time-picker-calendar-tile"
        onChange={this.onCalendarChange}
        onDrillDown={this.onDrilldown}
        nextLabel={<span className="fa fa-angle-right" />}
        prevLabel={<span className="fa fa-angle-left" />}
      />
    );
  }
}
