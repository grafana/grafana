import React, { FC } from 'react';
import RcTimePicker from 'rc-time-picker';
import { DateTime, dateTimeAsMoment } from '@grafana/data';

interface Props {
  onSelected: (value: any) => void;
  value: DateTime;
  showHour?: boolean;
}

export const TimeOfDayPicker: FC<Props> = ({ showHour = true, onSelected, value }) => {
  return (
    <div>
      <RcTimePicker
        defaultValue={dateTimeAsMoment()}
        onChange={onSelected}
        allowEmpty={false}
        showSecond={false}
        value={dateTimeAsMoment(value)}
        showHour={showHour}
      />
    </div>
  );
};
