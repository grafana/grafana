import React, { FC } from 'react';
import RcTimePicker from 'rc-time-picker';
import { DateTime, dateTimeAsMoment } from '@grafana/data';

interface Props {
  onSelected: (value: any) => void;
  value: DateTime;
}

export const TimeOfDayPicker: FC<Props> = ({ value, onSelected }) => {
  return (
    <div>
      <RcTimePicker
        defaultValue={dateTimeAsMoment()}
        onChange={onSelected}
        allowEmpty={false}
        showSecond={false}
        value={dateTimeAsMoment(value)}
      />
    </div>
  );
};
