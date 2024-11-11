import { css, cx } from '@emotion/css';
import { Moment } from 'moment';
import TimePicker from 'rc-time-picker';

import { GrafanaTheme2 } from '@grafana/data';
import { FormInputSize, Icon, useStyles2 } from '@grafana/ui';
import { inputSizes } from '@grafana/ui/src/components/Forms/commonStyles';
import { getFocusStyles } from '@grafana/ui/src/themes/mixins';

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
      return css({
        width: `${width}px`,
      });
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
        borderColor: borderColor,
        li: {
          outlineWidth: '2px',
          '&.rc-time-picker-panel-select-option-selected': {
            backgroundColor: 'inherit',
            border: `1px solid ${theme.v1.palette.orange}`,
            borderRadius: borderRadius,
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
        borderColor: borderColor,
        borderRadius: borderRadius,
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
        borderRadius: borderRadius,
        borderColor: borderColor,
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

      '.rc-time-picker-clear': {
        position: 'absolute',
        right: '20px',
        top: '50%',
        cursor: 'pointer',
        overflow: 'hidden',
        transform: 'translateY(-50%)',
        color: theme.colors.text.secondary,
      },
    }),
  };
};
