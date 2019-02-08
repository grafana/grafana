import React, { FunctionComponent, SyntheticEvent } from 'react';
import { TimeRaw, TimeOptions, TimeOption } from './TimePicker';
import { TimePickerCalendar } from './TimePickerCalendar';

export interface Props {
  value?: TimeRaw;
  popOverTimeOptions: TimeOptions;
  onClick: (timeOption: TimeOption) => void;
}

export const TimePickerPopOver: FunctionComponent<Props> = (props: Props) => {
  return (
    <div className={'time-picker-popover'}>
      <div className={'time-picker-popover-box'}>
        <div className={'time-picker-popover-box-header'}>
          <span className={'time-picker-popover-box-title'}>Quick ranges</span>
        </div>
        <div className={'time-picker-popover-box-body'}>
          {Object.keys(props.popOverTimeOptions).map(key => {
            return (
              <ul key={`popover-quickranges-${key}`}>
                {props.popOverTimeOptions[key].map(timeOption => (
                  <li
                    key={`popover-timeoption-${timeOption.from}-${timeOption.to}`}
                    className={timeOption.active ? 'active' : ''}
                  >
                    <a
                      onClick={(event: SyntheticEvent) => {
                        event.preventDefault();
                        props.onClick(timeOption);
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
            <TimePickerCalendar />
          </div>
          <div className={'time-picker-popover-box-body-custom-ranges'}>
            <TimePickerCalendar />
          </div>
        </div>
      </div>
    </div>
  );
};
