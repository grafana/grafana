import React, { PureComponent, ChangeEvent } from 'react';
import moment from 'moment';

import { Input } from '../Input/Input';
import * as dateMath from '../../../../../public/app/core/utils/datemath';
import { TimeFragment, TIME_FORMAT } from '../../types/time';
import { stringToMoment } from '../../utils/time';

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
      return value.format(TIME_FORMAT);
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
