import React, { PureComponent, ChangeEvent } from 'react';
import moment, { Moment } from 'moment';

import { Input } from '../Input/Input';
import * as dateMath from '../../../../../public/app/core/utils/datemath';

type TimeFragment = string | Moment;

const format = 'YYYY-MM-DD HH:mm:ss';

export const stringToMoment = (value: string, isTimezoneUtc: boolean): Moment => {
  if (isTimezoneUtc) {
    return moment.utc(value, format);
  }

  return moment(value, format);
};

export interface Props {
  isTimezoneUtc: boolean;
  initalValue: TimeFragment;
  onValidated: (isValid: boolean) => void;
}

export interface State {
  value: string;
  error: boolean;
}

export class TimePickerInput extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { value: this.valueToString(props.initalValue), error: false };
  }

  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    this.setState({ value });
  };

  onValidate = (event: ChangeEvent<HTMLInputElement>) => {
    const { isTimezoneUtc, onValidated } = this.props;
    const { value } = this.state;

    if (value.indexOf('now') !== -1) {
      const isValid = dateMath.isValid(value);

      onValidated(isValid);
      this.setState({ error: !isValid });
      return;
    }

    const parsed = stringToMoment(value, isTimezoneUtc);
    const isValid = parsed.isValid();

    onValidated(isValid);
    this.setState({ error: !isValid });
  };

  valueToString = (value: TimeFragment) => {
    if (moment.isMoment(value)) {
      return value.format(format);
    } else {
      return value;
    }
  };

  render() {
    const { value, error } = this.state;
    return (
      <Input
        type="text"
        onChange={this.onChange}
        onBlur={this.onValidate}
        hideErrorMessage={true}
        value={value}
        className={`time-picker-input${error ? '-error' : ''}`}
      />
    );
  }
}
