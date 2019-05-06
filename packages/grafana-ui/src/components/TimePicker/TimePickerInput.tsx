import React, { PureComponent, ChangeEvent, MouseEvent } from 'react';
import moment from 'moment';
import { TimeFragment, TIME_FORMAT } from '../../types/time';

import { stringToMoment, isValidTimeString } from './time';
import { Input } from '../Input/Input';

export interface Props {
  value: TimeFragment;
  isTimezoneUtc: boolean;
  roundup?: boolean;
  timezone?: string;
  onChange: (value: string, isValid: boolean) => void;
  tabIndex?: number;
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

  // Avoid propagate to react-select, since that prevents default behaviour and input's wont be focused
  stopPropagation = (evt: MouseEvent<HTMLInputElement>) => evt.stopPropagation();

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
        onMouseDown={this.stopPropagation}
        className={`time-picker-input${error ? '-error' : ''}`}
        tabIndex={tabIndex}
      />
    );
  }
}
