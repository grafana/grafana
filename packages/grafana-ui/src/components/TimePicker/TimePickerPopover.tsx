import React, { Component, SyntheticEvent } from 'react';
import { TimeRange, TimeOptions, TimeOption } from '@grafana/ui';
import { Moment } from 'moment';

import { TimePickerCalendar } from './TimePickerCalendar';
import { TimePickerInput } from './TimePickerInput';
import { mapTimeOptionToTimeRange } from './time';
import { Timezone } from '../../../../../public/app/core/utils/datemath';

export interface Props {
  value: TimeRange;
  options: TimeOptions;
  isTimezoneUtc: boolean;
  timezone?: Timezone;
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

  onFromCalendarChanged = (value: Moment) => {
    this.setState({
      value: { ...this.state.value, raw: { ...this.state.value.raw, from: value } },
    });
  };

  onToCalendarChanged = (value: Moment) => {
    this.setState({
      value: { ...this.state.value, raw: { ...this.state.value.raw, to: value } },
    });
  };

  onTimeOptionClick = (timeOption: TimeOption) => {
    const { isTimezoneUtc, timezone, onChange } = this.props;

    if (onChange) {
      onChange(mapTimeOptionToTimeRange(timeOption, isTimezoneUtc, timezone));
    }
  };

  onApplyClick = () => {
    const { onChange } = this.props;
    if (onChange) {
      onChange(this.state.value);
    }
  };

  render() {
    const { options, isTimezoneUtc, timezone } = this.props;
    const { isFromInputValid, isToInputValid, value } = this.state;
    const isValid = isFromInputValid && isToInputValid;

    return (
      <div className={TimePickerPopover.popoverClassName}>
        <div className="time-picker-popover-box">
          <div className="time-picker-popover-box-header">
            <span className="time-picker-popover-box-title">Quick ranges</span>
          </div>
          <div className="time-picker-popover-box-body">
            {Object.keys(options).map(key => {
              return (
                <ul key={`popover-quickranges-${key}`}>
                  {options[key].map(timeOption => (
                    <li
                      key={`popover-timeoption-${timeOption.from}-${timeOption.to}`}
                      className={timeOption.active ? 'active' : ''}
                    >
                      <a
                        onClick={(event: SyntheticEvent) => {
                          event.preventDefault();
                          this.onTimeOptionClick(timeOption);
                        }}
                      >
                        {timeOption.display}
                      </a>
                    </li>
                  ))}
                </ul>
              );
            })}
          </div>
        </div>
        <div className="time-picker-popover-box">
          <div className="time-picker-popover-box-header">
            <span className="time-picker-popover-box-title">Custom range</span>
          </div>
          <div className="time-picker-popover-box-body">
            <div className="time-picker-popover-box-body-custom-ranges">
              <div className="time-picker-popover-box-body-custom-ranges-input">
                <span>From:</span>
                <TimePickerInput
                  isTimezoneUtc={isTimezoneUtc}
                  roundup={false}
                  timezone={timezone}
                  value={value.raw.from}
                  onChange={this.onFromInputChanged}
                />
              </div>
              <div className="time-picker-popover-box-body-custom-ranges-calendar">
                <TimePickerCalendar
                  isTimezoneUtc={isTimezoneUtc}
                  roundup={false}
                  timezone={timezone}
                  value={value.raw.from}
                  onChange={this.onFromCalendarChanged}
                />
              </div>
            </div>
            <div className="time-picker-popover-box-body-custom-ranges">
              <div className="time-picker-popover-box-body-custom-ranges-input">
                <span>To:</span>
                <TimePickerInput
                  isTimezoneUtc={isTimezoneUtc}
                  roundup={true}
                  timezone={timezone}
                  value={value.raw.to}
                  onChange={this.onToInputChanged}
                />
              </div>
              <div className="time-picker-popover-box-body-custom-ranges-calendar">
                <TimePickerCalendar
                  isTimezoneUtc={isTimezoneUtc}
                  roundup={true}
                  timezone={timezone}
                  value={value.raw.to}
                  onChange={this.onToCalendarChanged}
                />
              </div>
            </div>
          </div>
          <div className="time-picker-popover-box-footer">
            <button
              type="submit"
              className="btn gf-form-btn btn-success"
              disabled={!isValid}
              onClick={this.onApplyClick}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    );
  }
}
