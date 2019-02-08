import React, { Component, SyntheticEvent } from 'react';
import moment from 'moment';

import { TimeOptions, TimeOption } from './TimePicker';
import { TimePickerCalendar } from './TimePickerCalendar';
import { TimeRange } from '../../types/time';
import { Input } from '../Input/Input';

export interface Props {
  value: TimeRange;
  popOverTimeOptions: TimeOptions;
  onClick: (timeOption: TimeOption) => void;
  isTimezoneUtc: boolean;
}

export class TimePickerPopOver extends Component<Props> {
  getDateAsString(value: any) {
    const format = 'YYYY-MM-DD HH:mm:ss';

    if (moment.isMoment(value)) {
      return value.format(format);
    } else {
      return value;
    }
  }

  render() {
    const { popOverTimeOptions, onClick, value } = this.props;

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
                          onClick(timeOption);
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
                <Input
                  type="text"
                  // onChange={this.onRelativeTimeChange}
                  // onBlur={this.onOverrideTime}
                  // validationEvents={timeRangeValidationEvents}
                  // hideErrorMessage={true}
                  value={this.getDateAsString(value.from)}
                />
              </div>
              <div className={'time-picker-popover-box-body-custom-ranges-calendar'}>
                <TimePickerCalendar />
              </div>
            </div>
            <div className={'time-picker-popover-box-body-custom-ranges'}>
              <div className={'time-picker-popover-box-body-custom-ranges-input'}>
                <span>To:</span>
                <Input
                  type="text"
                  // onChange={this.onRelativeTimeChange}
                  // onBlur={this.onOverrideTime}
                  // validationEvents={timeRangeValidationEvents}
                  // hideErrorMessage={true}
                  value={this.getDateAsString(value.from)}
                />
              </div>
              <div className={'time-picker-popover-box-body-custom-ranges-calendar'}>
                <TimePickerCalendar />
              </div>
            </div>
          </div>
          <div className={'time-picker-popover-box-footer'}>
            <button type="submit" className="btn gf-form-btn btn-success">
              Apply
            </button>
          </div>
        </div>
      </div>
    );
  }
}
