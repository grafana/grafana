import React, { FC, useContext } from 'react';
import RcTimePicker from 'rc-time-picker';
import { css } from 'emotion';
import { dateTime, DateTime, dateTimeAsMoment } from '@grafana/data';
import { ThemeContext } from '../../index';

interface Props {
  onChange: (value: DateTime) => void;
  value: DateTime;
  showHour?: boolean;
  minuteStep?: number;
}

export const TimeOfDayPicker: FC<Props> = ({ minuteStep = 1, showHour = true, onChange, value }) => {
  const theme = useContext(ThemeContext);

  const popupStyles = css`
    .rc-time-picker-panel-select {
      border-color: ${theme.colors.dark6};
      font-size: 14px;
      li {
        outline-width: 2px;
        &.rc-time-picker-panel-select-option-selected {
          background-color: inherit;
          border: 1px solid ${theme.colors.orange};
          border-radius: 2px;
        }
      }
    }
  `;

  return (
    <div>
      <RcTimePicker
        popupClassName={popupStyles}
        defaultValue={dateTimeAsMoment()}
        onChange={(value: any) => onChange(dateTime(value))}
        allowEmpty={false}
        showSecond={false}
        value={dateTimeAsMoment(value)}
        showHour={showHour}
        minuteStep={minuteStep}
        inputIcon={<Caret />}
      />
    </div>
  );
};

const Caret: FC = () => {
  const theme = useContext(ThemeContext);

  return (
    <div
      className={css`
        position: absolute;
        height: 100%;
        right: 8px;
        display: inline-block;
        text-align: right;
        z-index: 1071;
      `}
    >
      <span
        className={css`
          border-color: ${theme.colors.white} transparent transparent;
          border-style: solid;
          border-width: 4px 4px 2.5px;
          display: inline-block;
          position: absolute;
          top: 50%;
          right: 2px;
          margin-top: -2px;
        `}
      />
    </div>
  );
};
