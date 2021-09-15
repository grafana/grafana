import React, { FC } from 'react';
import RcTimePicker from 'rc-time-picker';
import { css, cx } from '@emotion/css';
import { dateTime, DateTime, dateTimeAsMoment, GrafanaTheme } from '@grafana/data';
import { Icon, useStyles } from '../../index';
import { stylesFactory } from '../../themes';
import { inputSizes } from '../Forms/commonStyles';
import { FormInputSize } from '../Forms/types';
import { focusCss } from '../../themes/mixins';

export interface Props {
  onChange: (value: DateTime) => void;
  value?: DateTime;
  showHour?: boolean;
  showSeconds?: boolean;
  minuteStep?: number;
  size?: FormInputSize;
  disabled?: boolean;
}

export const TimeOfDayPicker: FC<Props> = ({
  minuteStep = 1,
  showHour = true,
  showSeconds = false,
  onChange,
  value,
  size = 'auto',
  disabled,
}) => {
  const styles = useStyles(getStyles);

  return (
    <RcTimePicker
      className={cx(inputSizes()[size], styles.input)}
      popupClassName={styles.picker}
      defaultValue={dateTimeAsMoment()}
      onChange={(value: any) => onChange(dateTime(value))}
      allowEmpty={false}
      showSecond={showSeconds}
      value={dateTimeAsMoment(value)}
      showHour={showHour}
      minuteStep={minuteStep}
      inputIcon={<Caret wrapperStyle={styles.caretWrapper} />}
      disabled={disabled}
    />
  );
};

interface CaretProps {
  wrapperStyle?: string;
}

const Caret: FC<CaretProps> = ({ wrapperStyle = '' }) => {
  return (
    <div className={wrapperStyle}>
      <Icon name="angle-down" />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = theme.colors.formInputBg;
  const menuShadowColor = theme.colors.dropdownShadow;
  const optionBgHover = theme.colors.dropdownOptionHoverBg;
  const borderRadius = theme.border.radius.sm;
  const borderColor = theme.colors.formInputBorder;
  return {
    caretWrapper: css`
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-block;
      text-align: right;
      color: ${theme.colors.textWeak};
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
            border: 1px solid ${theme.palette.orange};
            border-radius: ${borderRadius};
          }

          &:hover {
            background: ${optionBgHover};
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
        height: ${theme.spacing.formInputHeight}px;

        &:focus {
          ${focusCss(theme)}
        }

        &:disabled {
          background-color: ${theme.colors.formInputBgDisabled};
          color: ${theme.colors.formInputDisabledText};
          border: 1px solid ${theme.colors.formInputBgDisabled};
          &:focus {
            box-shadow: none;
          }
        }
      }
    `,
  };
});
