// Libraries
import React, { Component } from 'react';

// Components
import { TimePickerCalendar } from './TimePickerCalendar';
import { TimePickerInput } from './TimePickerInput';
import { rawToTimeRange } from './time';

// Types
import { DateTime } from '../../utils/moment_wrapper';
import { TimeRange, TimeZone } from '../../types/time';

export interface Props {
  value: TimeRange;
  timeZone?: TimeZone;
  onChange: (timeRange: TimeRange) => void;
}

export interface State {
  from: DateTime | string;
  to: DateTime | string;
  isFromInputValid: boolean;
  isToInputValid: boolean;
}

export class TimePickerPopover extends Component<Props, State> {
  static popoverClassName = 'time-picker-popover';

  constructor(props: Props) {
    super(props);

    this.state = {
      from: props.value.raw.from,
      to: props.value.raw.to,
      isFromInputValid: true,
      isToInputValid: true,
    };
  }

  onFromInputChanged = (value: string, valid: boolean) => {
    this.setState({ from: value, isFromInputValid: valid });
  };

  onToInputChanged = (value: string, valid: boolean) => {
    this.setState({ to: value, isToInputValid: valid });
  };

  onFromCalendarChanged = (value: DateTime) => {
    this.setState({ from: value });
  };

  onToCalendarChanged = (value: DateTime) => {
    value.set('h', 23);
    value.set('m', 59);
    value.set('s', 0);
    this.setState({ to: value });
  };

  onApplyClick = () => {
    const { onChange, timeZone } = this.props;
    const { from, to } = this.state;

    onChange(rawToTimeRange({ from, to }, timeZone));
  };

  render() {
    const { timeZone } = this.props;
    const { isFromInputValid, isToInputValid, from, to } = this.state;

    const isValid = isFromInputValid && isToInputValid;

    return (
      <div className={TimePickerPopover.popoverClassName}>
        <div className="time-picker-popover-body">
          <div className="time-picker-popover-body-custom-ranges">
            <div className="time-picker-popover-body-custom-ranges-input">
              <div className="gf-form">
                <label className="gf-form-label">From</label>
                <TimePickerInput
                  roundup={false}
                  timeZone={timeZone}
                  value={from}
                  onChange={this.onFromInputChanged}
                  tabIndex={1}
                />
              </div>
            </div>
            <div className="time-picker-popover-body-custom-ranges-calendar">
              <TimePickerCalendar
                timeZone={timeZone}
                roundup={false}
                value={from}
                onChange={this.onFromCalendarChanged}
              />
            </div>
          </div>
          <div className="time-picker-popover-body-custom-ranges">
            <div className="time-picker-popover-body-custom-ranges-input">
              <div className="gf-form">
                <label className="gf-form-label">To</label>
                <TimePickerInput
                  roundup={true}
                  timeZone={timeZone}
                  value={to}
                  onChange={this.onToInputChanged}
                  tabIndex={2}
                />
              </div>
            </div>
            <div className="time-picker-popover-body-custom-ranges-calendar">
              <TimePickerCalendar roundup={true} timeZone={timeZone} value={to} onChange={this.onToCalendarChanged} />
            </div>
          </div>
        </div>
        <div className="time-picker-popover-footer">
          <button type="submit" className="btn btn-success" disabled={!isValid} onClick={this.onApplyClick}>
            Apply
          </button>
        </div>
      </div>
    );
  }
}
