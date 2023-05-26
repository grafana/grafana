import { css, cx } from '@emotion/css';
import RcTimePicker from 'rc-time-picker';
import React from 'react';

import { dateTime, DateTime, dateTimeAsMoment, GrafanaTheme2 } from '@grafana/data';

import { Icon, useStyles2 } from '../../index';
import { focusCss } from '../../themes/mixins';
import { inputSizes } from '../Forms/commonStyles';
import { FormInputSize } from '../Forms/types';

export interface Props {
  onChange: (value: DateTime) => void;
  value?: DateTime;
  showHour?: boolean;
  showSeconds?: boolean;
  minuteStep?: number;
  size?: FormInputSize;
  disabled?: boolean;
  disabledHours?: () => number[];
  disabledMinutes?: () => number[];
  disabledSeconds?: () => number[];
}

export const POPUP_CLASS_NAME = 'time-of-day-picker-panel';

export const TimeOfDayPicker = ({
  minuteStep = 1,
  showHour = true,
  showSeconds = false,
  onChange,
  value,
  size = 'auto',
  disabled,
  disabledHours,
  disabledMinutes,
  disabledSeconds,
}: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <RcTimePicker
      className={cx(inputSizes()[size], styles.input)}
      popupClassName={cx(styles.picker, POPUP_CLASS_NAME)}
      defaultValue={dateTimeAsMoment()}
      onChange={(value: any) => onChange(dateTime(value))}
      allowEmpty={false}
      showSecond={showSeconds}
      value={dateTimeAsMoment(value)}
      showHour={showHour}
      minuteStep={minuteStep}
      inputIcon={<Caret wrapperStyle={styles.caretWrapper} />}
      disabled={disabled}
      disabledHours={disabledHours}
      disabledMinutes={disabledMinutes}
      disabledSeconds={disabledSeconds}
    />
  );
};

interface CaretProps {
  wrapperStyle?: string;
}

const Caret = ({ wrapperStyle = '' }: CaretProps) => {
  return (
    <div className={wrapperStyle}>
      <Icon name="angle-down" />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const bgColor = theme.components.input.background;
  const menuShadowColor = theme.v1.palette.black;
  const optionBgHover = theme.colors.background.secondary;
  const borderRadius = theme.shape.borderRadius(1);
  const borderColor = theme.components.input.borderColor;
  return {
    caretWrapper: css`
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-block;
      text-align: right;
      color: ${theme.colors.text.secondary};
    `,
    picker: css`
      .rc-time-picker-panel-select {
        font-size: 14px;
        background-color: ${bgColor};
        border-color: ${borderColor};
        li {
          outline-width: 2px;
          &.rc-time-picker-panel-select-option-selected {
            background-color: inherit;
            border: 1px solid ${theme.v1.palette.orange};
            border-radius: ${borderRadius};
          }

          &:hover {
            background: ${optionBgHover};
          }

          &.rc-time-picker-panel-select-option-disabled {
            color: ${theme.colors.action.disabledText};
          }
        }
      }

      .rc-time-picker-panel-inner {
        box-shadow: 0px 4px 4px ${menuShadowColor};
        background-color: ${bgColor};
        border-color: ${borderColor};
        border-radius: ${borderRadius};
        margin-top: 3px;

        .rc-time-picker-panel-input-wrap {
          margin-right: 2px;

          &,
          .rc-time-picker-panel-input {
            background-color: ${bgColor};
            padding-top: 2px;
          }
        }

        .rc-time-picker-panel-combobox {
          display: flex;
        }
      }
    `,
    input: css`
      .rc-time-picker-input {
        background-color: ${bgColor};
        border-radius: ${borderRadius};
        border-color: ${borderColor};
        height: ${theme.spacing(4)};

        &:focus {
          ${focusCss(theme)}
        }

        &:disabled {
          background-color: ${theme.colors.action.disabledBackground};
          color: ${theme.colors.action.disabledText};
          border: 1px solid ${theme.colors.action.disabledBackground};
          &:focus {
            box-shadow: none;
          }
        }
      }
    `,
  };
};
