import React, { FC } from 'react';
import RcTimePicker from 'rc-time-picker';
import { dateTime, DateTime, dateTimeAsMoment } from '@grafana/data';
import { inputSizes } from '../Forms/commonStyles';
import { FormInputSize } from '../Forms/types';

interface Props {
  onChange: (value: DateTime) => void;
  value: DateTime;
  showHour?: boolean;
  minuteStep?: number;
  size?: FormInputSize;
}

export const TimeOfDayPicker: FC<Props> = ({ minuteStep = 1, showHour = true, onChange, value, size = 'auto' }) => {
  return (
    <div>
      <RcTimePicker
        className={inputSizes()[size]}
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
