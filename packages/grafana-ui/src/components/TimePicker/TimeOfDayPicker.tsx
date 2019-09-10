import React, { FC } from 'react';
import RcTimePicker from 'rc-time-picker';
import { dateTime, DateTime, dateTimeAsMoment } from '@grafana/data';

interface Props {
  onChange: (value: DateTime) => void;
  value: DateTime;
  showHour?: boolean;
  minuteStep?: number;
}

export const TimeOfDayPicker: FC<Props> = ({ minuteStep = 1, showHour = true, onChange, value }) => {
  return (
    <div>
      <RcTimePicker
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
