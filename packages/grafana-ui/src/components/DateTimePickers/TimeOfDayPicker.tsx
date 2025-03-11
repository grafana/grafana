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

interface BaseProps {
  onChange: (value: DateTime) => void | ((value?: DateTime) => void);
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

interface AllowEmptyProps extends BaseProps {
  allowEmpty: true;
  onChange: (value?: DateTime) => void;
}

interface NoAllowEmptyProps extends BaseProps {
  allowEmpty?: false;
  onChange: (value: DateTime) => void;
}

export type Props = AllowEmptyProps | NoAllowEmptyProps;

export const POPUP_CLASS_NAME = 'time-of-day-picker-panel';

export const TimeOfDayPicker = ({
  minuteStep = 1,
  showHour = true,
  showSeconds = false,
  value,
  size = 'auto',
  disabled,
  disabledHours,
  disabledMinutes,
  disabledSeconds,
  placeholder,
  // note: we can't destructure allowEmpty/onChange here
  // in order to discriminate the types properly later in the onChange handler
  ...restProps
}: Props) => {
  const styles = useStyles2(getStyles);
  const allowClear = restProps.allowEmpty ?? false;

  return (
    <RcPicker<Moment>
      generateConfig={generateConfig}
      locale={locale}
      allowClear={
        allowClear && {
          clearIcon: <Icon name="times" className={styles.clearIcon} />,
        }
      }
      className={cx(inputSizes()[size], styles.input)}
      classNames={{
        popup: cx(styles.picker, POPUP_CLASS_NAME),
      }}
      defaultValue={restProps.allowEmpty ? undefined : dateTimeAsMoment()}
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
          if (restProps.allowEmpty) {
            return restProps.onChange(value ? dateTime(value) : undefined);
          } else {
            return restProps.onChange(dateTime(value));
          }
        }
      }}
      picker="time"
      placeholder={placeholder}
      showNow={false}
      needConfirm={false}
      suffixIcon={<Caret wrapperStyle={styles.caretWrapper} />}
      value={value ? dateTimeAsMoment(value) : value}
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
  const optionBgHover = theme.colors.action.hover;
  const borderRadius = theme.shape.radius.default;
  const borderColor = theme.components.input.borderColor;

  return {
    caretWrapper: css({
      position: 'relative',
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'inline-block',
      color: theme.colors.text.secondary,
    }),
    clearIcon: css({
      color: theme.colors.text.secondary,

      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
    }),
    picker: css({
      '&.rc-picker-dropdown': {
        boxShadow: 'none',
        zIndex: theme.zIndex.portal,
      },
      '.rc-picker-time-panel-column': {
        fontSize: theme.typography.htmlFontSize,
        backgroundColor: bgColor,
        color: theme.colors.text.secondary,
        padding: 'unset',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        width: theme.spacing(8),
        li: {
          paddingRight: theme.spacing(2),
          width: 'auto',
          '&.rc-picker-time-panel-cell-selected': {
            backgroundColor: 'inherit',
            border: `1px solid ${theme.colors.action.selectedBorder}`,
            borderRadius,
            color: theme.colors.text.primary,
          },

          '&:hover': {
            background: optionBgHover,
            color: theme.colors.text.primary,
          },

          '&.rc-picker-time-panel-cell-disabled': {
            color: theme.colors.action.disabledText,
          },
        },

        '.rc-picker-time-panel-cell-inner': {
          color: 'inherit',
        },

        '&:not(:last-of-type)': {
          borderRight: `1px solid ${borderColor}`,
        },
      },

      '.rc-picker-panel': {
        boxShadow: theme.shadows.z3,
        backgroundColor: bgColor,
        borderColor,
        borderRadius,
        overflow: 'hidden',
      },
    }),
    input: css({
      '&.rc-picker-focused': {
        border: 'none',

        '.rc-picker-input': getFocusStyles(theme),
      },

      '&.rc-picker-disabled': {
        '.rc-picker-input': {
          backgroundColor: theme.colors.action.disabledBackground,
          color: theme.colors.action.disabledText,
          border: `1px solid ${theme.colors.action.disabledBackground}`,
          '&:focus': {
            boxShadow: 'none',
          },
        },
      },

      '.rc-picker-input': {
        backgroundColor: bgColor,
        borderRadius,
        borderColor,
        borderStyle: 'solid',
        borderWidth: '1px',
        color: theme.colors.text.primary,
        height: theme.spacing(4),
        padding: theme.spacing(0, 1),

        input: {
          color: 'unset',
          backgroundColor: 'unset',
          '&:focus': {
            outline: 'none',
          },

          '&::placeholder': {
            color: theme.colors.text.disabled,
          },
        },
      },

      '.rc-picker-clear': {
        alignItems: 'center',
        display: 'flex',
        insetInlineEnd: 'unset',
        position: 'relative',
      },
    }),
  };
};
