import { css, cx } from '@emotion/css';
import { Moment } from 'moment';
import TimePicker from 'rc-time-picker';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FormInputSize, Icon, useStyles2 } from '@grafana/ui';
import { inputSizes } from '@grafana/ui/src/components/Forms/commonStyles';
import { focusCss } from '@grafana/ui/src/themes/mixins';

export interface Props {
  onChange: (value: Moment) => void;
  value?: Moment;
  defaultValue?: Moment;
  showHour?: boolean;
  showSeconds?: boolean;
  minuteStep?: number;
  size?: FormInputSize;
  disabled?: boolean;
  disabledHours?: () => number[];
  disabledMinutes?: () => number[];
  disabledSeconds?: () => number[];
  placeholder?: string;
  format?: string;
  allowEmpty?: boolean;
  width?: number;
}

export const POPUP_CLASS_NAME = 'time-of-day-picker-panel';

// @TODO fix TimeOfDayPicker and switch?
export const TimePickerInput = ({
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
  placeholder,
  format = 'HH:mm',
  defaultValue = undefined,
  allowEmpty = false,
  width,
}: Props) => {
  const styles = useStyles2(getStyles);

  const getWidth = () => {
    if (width) {
      return css`
        width: ${width}px;
      `;
    }

    return inputSizes()[size];
  };

  return (
    <TimePicker
      value={value}
      defaultValue={defaultValue}
      onChange={(v) => onChange(v)}
      showHour={showHour}
      showSecond={showSeconds}
      format={format}
      allowEmpty={allowEmpty}
      className={cx(getWidth(), styles.input)}
      popupClassName={cx(styles.picker, POPUP_CLASS_NAME)}
      minuteStep={minuteStep}
      inputIcon={<Caret wrapperStyle={styles.caretWrapper} />}
      disabled={disabled}
      disabledHours={disabledHours}
      disabledMinutes={disabledMinutes}
      disabledSeconds={disabledSeconds}
      placeholder={placeholder}
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

      .rc-time-picker-clear {
        position: absolute;
        right: 20px;
        top: 50%;
        cursor: pointer;
        overflow: hidden;
        transform: translateY(-50%);
        color: ${theme.colors.text.secondary};
      }
    `,
  };
};
