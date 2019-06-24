import React, { PureComponent, ChangeEvent } from 'react';
import { TimeFragment, TIME_FORMAT, TimeZone } from '../../types/time';
import { Input } from '../Input/Input';
import { stringToDateTimeType, isValidTimeString } from './time';
import { isDateTime } from '../../utils/moment_wrapper';

export interface Props {
  value: TimeFragment;
  roundup?: boolean;
  timeZone?: TimeZone;
  onChange: (value: string, isValid: boolean) => void;
  tabIndex?: number;
}

export class TimePickerInput extends PureComponent<Props> {
  isValid = (value: string) => {
    const { timeZone, roundup } = this.props;

    if (value.indexOf('now') !== -1) {
      const isValid = isValidTimeString(value);
      return isValid;
    }

    const parsed = stringToDateTimeType(value, roundup, timeZone);
    const isValid = parsed.isValid();
    return isValid;
  };

  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange } = this.props;
    const value = event.target.value;

    onChange(value, this.isValid(value));
  };

  valueToString = (value: TimeFragment) => {
    if (isDateTime(value)) {
      return value.format(TIME_FORMAT);
    } else {
      return value;
    }
  };

  render() {
    const { value, tabIndex } = this.props;
    const valueString = this.valueToString(value);
    const error = !this.isValid(valueString);

    return (
      <Input
        type="text"
        onChange={this.onChange}
        onBlur={this.onChange}
        hideErrorMessage={true}
        value={valueString}
        className={`time-picker-input${error ? '-error' : ''}`}
        tabIndex={tabIndex}
      />
    );
  }
}
