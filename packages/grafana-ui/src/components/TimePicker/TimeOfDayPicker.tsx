import React, { FC } from 'react';
import RcTimePicker from 'rc-time-picker';
import classNames from 'classnames';
import { dateTime, DateTime, dateTimeAsMoment } from '@grafana/data';

interface Props {
  onChange: (value: DateTime) => void;
  value: DateTime;
  showHour?: boolean;
  minuteStep?: number;
  width?: number;
}

export const TimeOfDayPicker: FC<Props> = ({ minuteStep = 1, showHour = true, onChange, value, width }) => {
  return (
    <div>
      <RcTimePicker
        className={classNames({ [`width-${width}`]: width })}
        defaultValue={dateTimeAsMoment()}
        onChange={(value: any) => onChange(dateTime(value))}
        allowEmpty={false}
        showSecond={false}
        value={dateTimeAsMoment(value)}
        showHour={showHour}
        minuteStep={minuteStep}
      />
    </div>
  );
};
