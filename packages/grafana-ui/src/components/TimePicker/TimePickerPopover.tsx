import React, { Component } from 'react';
import { TimeRange, TimeOption, TimeZone } from '../../types/time';

import { TimePickerCalendar } from './TimePickerCalendar';
import { TimePickerInput } from './TimePickerInput';
import { mapTimeOptionToTimeRange } from './time';
import { DateTime } from '../../utils/moment_wrapper';

export interface Props {
  value: TimeRange;
  timeZone?: TimeZone;
  onChange?: (timeRange: TimeRange) => void;
}

export interface State {
  value: TimeRange;
  isFromInputValid: boolean;
  isToInputValid: boolean;
}

export class TimePickerPopover extends Component<Props, State> {
  static popoverClassName = 'time-picker-popover';

  constructor(props: Props) {
    super(props);
    this.state = { value: props.value, isFromInputValid: true, isToInputValid: true };
  }

  onFromInputChanged = (value: string, valid: boolean) => {
    this.setState({
      value: { ...this.state.value, raw: { ...this.state.value.raw, from: value } },
      isFromInputValid: valid,
    });
  };

  onToInputChanged = (value: string, valid: boolean) => {
    this.setState({
      value: { ...this.state.value, raw: { ...this.state.value.raw, to: value } },
      isToInputValid: valid,
    });
  };

  onFromCalendarChanged = (value: DateTime) => {
    this.setState({
      value: { ...this.state.value, raw: { ...this.state.value.raw, from: value } },
    });
  };

  onToCalendarChanged = (value: DateTime) => {
    this.setState({
      value: { ...this.state.value, raw: { ...this.state.value.raw, to: value } },
    });
  };

  onTimeOptionClick = (timeOption: TimeOption) => {
    const { timeZone, onChange } = this.props;

    if (onChange) {
      onChange(mapTimeOptionToTimeRange(timeOption, timeZone));
    }
  };

  onApplyClick = () => {
    const { onChange } = this.props;
    if (onChange) {
      onChange(this.state.value);
    }
  };

  render() {
    const { timeZone } = this.props;
    const { isFromInputValid, isToInputValid, value } = this.state;

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
                  value={value.raw.from}
                  onChange={this.onFromInputChanged}
                  tabIndex={1}
                />
              </div>
            </div>
            <div className="time-picker-popover-body-custom-ranges-calendar">
              <TimePickerCalendar
                timeZone={timeZone}
                roundup={false}
                value={value.raw.from}
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
                  value={value.raw.to}
                  onChange={this.onToInputChanged}
                  tabIndex={2}
                />
              </div>
            </div>
            <div className="time-picker-popover-body-custom-ranges-calendar">
              <TimePickerCalendar
                roundup={true}
                timeZone={timeZone}
                value={value.raw.to}
                onChange={this.onToCalendarChanged}
              />
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
