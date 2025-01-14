import { css, cx } from '@emotion/css';
import { Moment } from 'moment';
import RcPicker, { PickerProps } from 'rc-picker';
import generateConfig from 'rc-picker/lib/generate/moment';
import locale from 'rc-picker/lib/locale/en_US';

import { dateTime, DateTime, dateTimeAsMoment, GrafanaTheme2, isDateTimeInput } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { inputSizes } from '../Forms/commonStyles';
import { FormInputSize } from '../Forms/types';
import { Icon } from '../Icon/Icon';
import 'rc-picker/assets/index.css';

export interface Props {
  onChange: (value?: DateTime) => void;
  value?: DateTime;
  showHour?: boolean;
  showSeconds?: boolean;
  minuteStep?: PickerProps['minuteStep'];
  size?: FormInputSize;
  disabled?: boolean;
  disabledHours?: () => number[];
  disabledMinutes?: () => number[];
  disabledSeconds?: () => number[];
  placeholder?: string;
  allowEmpty?: boolean;
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
  placeholder,
  allowEmpty = false,
}: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <RcPicker<Moment>
      // TODO figure out these
      generateConfig={generateConfig}
      locale={locale}
      allowClear={allowEmpty}
      className={cx(inputSizes()[size], styles.input)}
      classNames={{
        popup: cx(styles.picker, POPUP_CLASS_NAME),
      }}
      defaultValue={allowEmpty ? undefined : dateTimeAsMoment()}
      disabled={disabled}
      disabledTime={() => ({
        disabledHours,
        disabledMinutes,
        disabledSeconds,
      })}
      format={generateFormat(showHour, showSeconds)}
      minuteStep={minuteStep}
      onChange={(value) => {
        if (isDateTimeInput(value)) {
          return onChange(value ? dateTime(value) : undefined);
        }
      }}
      picker="time"
      placeholder={placeholder}
      showNow={false}
      needConfirm={false}
      suffixIcon={<Caret wrapperStyle={styles.caretWrapper} />}
      value={value ? dateTimeAsMoment(value) : undefined}
    />
  );
};

function generateFormat(showHour = true, showSeconds = false) {
  const maybeHour = showHour ? 'HH:' : '';
  const maybeSecond = showSeconds ? ':ss' : '';
  return maybeHour + 'mm' + maybeSecond;
}

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
  const optionBgHover = theme.colors.action.hover;
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
      '&.rc-picker-dropdown': {
        boxShadow: 'none',
        zIndex: theme.zIndex.dropdown,
      },
      '.rc-picker-time-panel-column': {
        fontSize: '14px',
        backgroundColor: bgColor,
        color: theme.colors.text.secondary,
        borderColor,
        li: {
          outlineWidth: '2px',
          '&.rc-picker-time-panel-cell-selected': {
            backgroundColor: 'inherit',
            border: `1px solid ${theme.v1.palette.orange}`,
            borderRadius,
            color: theme.colors.text.primary,
          },

          '&:hover': {
            background: optionBgHover,
            color: theme.colors.text.primary,
          },

          // TODO check this
          '&.rc-picker-time-panel-cell-disabled': {
            color: theme.colors.action.disabledText,
          },
        },

        '.rc-picker-time-panel-cell-inner': {
          color: 'inherit',
        },
      },

      '.rc-picker-panel': {
        boxShadow: `0px 4px 4px ${menuShadowColor}`,
        backgroundColor: bgColor,
        borderColor,
        borderRadius,
      },
    }),
    input: css({
      '&.rc-picker-focused': {
        border: 'none',
      },

      input: {
        backgroundColor: bgColor,
        borderRadius,
        borderColor,
        borderStyle: 'solid',
        borderWidth: '1px',
        color: theme.colors.text.primary,
        height: theme.spacing(4),
        padding: theme.spacing(0, 1),

        '&:focus': getFocusStyles(theme),

        '&:disabled': {
          backgroundColor: theme.colors.action.disabledBackground,
          color: theme.colors.action.disabledText,
          border: `1px solid ${theme.colors.action.disabledBackground}`,
          '&:focus': {
            boxShadow: 'none',
          },
        },

        '&::placeholder': {
          color: theme.colors.text.disabled,
        },
      },
    }),
  };
};
