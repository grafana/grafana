import React, { Component, SyntheticEvent } from 'react';
import { TimeOptions, TimeOption } from './TimePicker';
import { TimePickerCalendar } from './TimePickerCalendar';
import { TimeRange } from '@grafana/ui';

export interface Props {
  value?: TimeRange;
  popOverTimeOptions: TimeOptions;
  onClick: (timeOption: TimeOption) => void;
}

export class TimePickerPopOver extends Component<Props> {
  render() {
    const { popOverTimeOptions, onClick } = this.props;

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
                <input type="text" />
              </div>
              <div className={'time-picker-popover-box-body-custom-ranges-calendar'}>
                <TimePickerCalendar />
              </div>
            </div>
            <div className={'time-picker-popover-box-body-custom-ranges'}>
              <div className={'time-picker-popover-box-body-custom-ranges-input'}>
                <input type="text" />
              </div>
              <div className={'time-picker-popover-box-body-custom-ranges-calendar'}>
                <TimePickerCalendar />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
