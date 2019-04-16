import React, { PureComponent, ChangeEvent } from 'react';
import moment from 'moment';
import { TimeFragment, TIME_FORMAT, Input } from '@grafana/ui';

import { stringToMoment, isValidTimeString } from './time';

export interface Props {
  value: TimeFragment;
  isTimezoneUtc: boolean;
  roundup?: boolean;
  timezone?: string;
  onChange: (value: string, isValid: boolean) => void;
}

export class TimePickerInput extends PureComponent<Props> {
  isValid = (value: string) => {
    const { isTimezoneUtc } = this.props;

    if (value.indexOf('now') !== -1) {
      const isValid = isValidTimeString(value);
      return isValid;
    }

    const parsed = stringToMoment(value, isTimezoneUtc);
    const isValid = parsed.isValid();
    return isValid;
  };

  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange } = this.props;
    const value = event.target.value;

    onChange(value, this.isValid(value));
  };

  valueToString = (value: TimeFragment) => {
    if (moment.isMoment(value)) {
      return value.format(TIME_FORMAT);
    } else {
      return value;
    }
  };

  render() {
    const { value } = this.props;
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
      />
    );
  }
}
