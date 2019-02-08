import React, { Component, SyntheticEvent } from 'react';

import { TimePickerCalendar, CalendarType } from './TimePickerCalendar';
import { TimeRange, TimeOption, TimeOptions } from '../../types/time';
import { TimePickerInput } from './TimePickerInput';
import { mapTimeOptionToTimeRange } from '../../utils/time';

export interface Props {
  value: TimeRange;
  popOverTimeOptions: TimeOptions;
  onChange: (timeRange: TimeRange) => void;
  isTimezoneUtc: boolean;
  timezone?: string;
}

export interface State {
  isFromInputValid: boolean;
  isToInputValid: boolean;
  editValue: TimeRange;
}

export class TimePickerPopOver extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { editValue: props.value, isFromInputValid: true, isToInputValid: true };
  }

  onFromInputValidated = (valid: boolean) => {
    this.setState({ isFromInputValid: valid });
  };

  onToInputValidated = (valid: boolean) => {
    this.setState({ isToInputValid: valid });
  };

  onTimeOptionClick = (timeOption: TimeOption) => {
    const { isTimezoneUtc, timezone } = this.props;

    this.props.onChange(mapTimeOptionToTimeRange(timeOption, isTimezoneUtc, timezone));
  };

  onApplyClick = () => {
    this.props.onChange(this.state.editValue);
  };

  render() {
    const { popOverTimeOptions, value, isTimezoneUtc } = this.props;
    const { editValue, isFromInputValid, isToInputValid } = this.state;
    const isValid = isFromInputValid && isToInputValid;

    return (
      <div className={'time-picker-popover'}>
        <div className={'time-picker-popover-box'}>
          <div className={'time-picker-popover-box-header'}>
            <span className={'time-picker-popover-box-title'}>Quick ranges</span>
          </div>
          <div className={'time-picker-popover-box-body'}>
            {Object.keys(popOverTimeOptions).map(key => {
              return (
                <ul key={`popover-quickranges-${key}`}>
                  {popOverTimeOptions[key].map(timeOption => (
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
        <div className={'time-picker-popover-box'}>
          <div className={'time-picker-popover-box-header'}>
            <span className={'time-picker-popover-box-title'}>Custom range</span>
          </div>
          <div className={'time-picker-popover-box-body'}>
            <div className={'time-picker-popover-box-body-custom-ranges'}>
              <div className={'time-picker-popover-box-body-custom-ranges-input'}>
                <span>From:</span>
                <TimePickerInput
                  isTimezoneUtc={isTimezoneUtc}
                  initalValue={editValue.raw.from}
                  onValidated={this.onFromInputValidated}
                />
              </div>
              <div className={'time-picker-popover-box-body-custom-ranges-calendar'}>
                <TimePickerCalendar calendarType={CalendarType.From} value={value} />
              </div>
            </div>
            <div className={'time-picker-popover-box-body-custom-ranges'}>
              <div className={'time-picker-popover-box-body-custom-ranges-input'}>
                <span>To:</span>
                <TimePickerInput
                  isTimezoneUtc={isTimezoneUtc}
                  initalValue={editValue.raw.to}
                  onValidated={this.onToInputValidated}
                />
              </div>
              <div className={'time-picker-popover-box-body-custom-ranges-calendar'}>
                <TimePickerCalendar calendarType={CalendarType.To} value={value} />
              </div>
            </div>
          </div>
          <div className={'time-picker-popover-box-footer'}>
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
