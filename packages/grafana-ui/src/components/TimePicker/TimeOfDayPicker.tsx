import React, { FC } from 'react';
import RcTimePicker from 'rc-time-picker';
import { DateTime, dateTimeAsMoment } from '@grafana/data';

interface Props {
  onSelected: (value: any) => void;
  value: DateTime;
  showHour?: boolean;
  minuteStep?: number;
}

export const TimeOfDayPicker: FC<Props> = ({ minuteStep = 1, showHour = true, onSelected, value }) => {
  return (
    <div>
      <RcTimePicker
        defaultValue={dateTimeAsMoment()}
        onChange={onSelected}
        allowEmpty={false}
        showSecond={false}
        value={dateTimeAsMoment(value)}
        showHour={showHour}
        minuteStep={minuteStep}
      />
    </div>
  );
};
