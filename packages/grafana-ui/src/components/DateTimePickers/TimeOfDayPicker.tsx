import { css, cx } from '@emotion/css';
import RcTimePicker from 'rc-time-picker';
import React from 'react';

import { dateTime, DateTime, dateTimeAsMoment, GrafanaTheme2, isDateTimeInput } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { inputSizes } from '../Forms/commonStyles';
import { FormInputSize } from '../Forms/types';
import { Icon } from '../Icon/Icon';

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
      onChange={(value) => {
        if (isDateTimeInput(value)) {
          return onChange(dateTime(value));
        }
      }}
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
  const borderRadius = theme.shape.radius.default;
  const borderColor = theme.components.input.borderColor;
  return {
    caretWrapper: css({
      position: 'absolute',
      right: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'inline-block',
      textAlign: 'right',
      color: theme.colors.text.secondary,
    }),
    picker: css({
      '.rc-time-picker-panel-select': {
        fontSize: '14px',
        backgroundColor: bgColor,
        borderColor,
        li: {
          outlineWidth: '2px',
          '&.rc-time-picker-panel-select-option-selected': {
            backgroundColor: 'inherit',
            border: `1px solid ${theme.v1.palette.orange}`,
            borderRadius,
          },

          '&:hover': {
            background: optionBgHover,
          },

          '&.rc-time-picker-panel-select-option-disabled': {
            color: theme.colors.action.disabledText,
          },
        },
      },

      '.rc-time-picker-panel-inner': {
        boxShadow: `0px 4px 4px ${menuShadowColor}`,
        backgroundColor: bgColor,
        borderColor,
        borderRadius,
        marginTop: '3px',

        '.rc-time-picker-panel-input-wrap': {
          marginRight: '2px',

          '&, .rc-time-picker-panel-input': {
            backgroundColor: bgColor,
            paddingTop: '2px',
          },
        },

        '.rc-time-picker-panel-combobox': {
          display: 'flex',
        },
      },
    }),
    input: css({
      '.rc-time-picker-input': {
        backgroundColor: bgColor,
        borderRadius,
        borderColor,
        height: theme.spacing(4),

        '&:focus': getFocusStyles(theme),

        '&:disabled': {
          backgroundColor: theme.colors.action.disabledBackground,
          color: theme.colors.action.disabledText,
          border: `1px solid ${theme.colors.action.disabledBackground}`,
          '&:focus': {
            boxShadow: 'none',
          },
        },
      },
    }),
  };
};
