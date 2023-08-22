import { css, cx } from '@emotion/css';
import React, { FormEvent, MouseEvent, useState } from 'react';

import { dateTime, getDefaultTimeRange, GrafanaTheme2, TimeRange, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { stylesFactory } from '../../themes';
import { useTheme2 } from '../../themes/ThemeContext';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../Icon/Icon';
import { getInputStyles } from '../Input/Input';

import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { TimeRangeLabel } from './TimeRangePicker/TimeRangeLabel';
import { quickOptions } from './options';
import { isValidTimeRange } from './utils';

export interface TimeRangeInputProps {
  value: TimeRange;
  timeZone?: TimeZone;
  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone?: (timeZone: TimeZone) => void;
  hideTimeZone?: boolean;
  placeholder?: string;
  clearable?: boolean;
  /** Controls horizontal alignment of the picker menu */
  isReversed?: boolean;
  /** Controls visibility of the preset time ranges (e.g. **Last 5 minutes**) in the picker menu */
  hideQuickRanges?: boolean;
  disabled?: boolean;
  showIcon?: boolean;
}

const noop = () => {};

export const TimeRangeInput = ({
  value,
  onChange,
  onChangeTimeZone = noop,
  clearable,
  hideTimeZone = true,
  timeZone = 'browser',
  placeholder = 'Select time range',
  isReversed = true,
  hideQuickRanges = false,
  disabled = false,
  showIcon = false,
}: TimeRangeInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme2();
  const styles = getStyles(theme, disabled);

  const onOpen = (event: FormEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (disabled) {
      return;
    }
    setIsOpen(!isOpen);
  };

  const onClose = () => {
    setIsOpen(false);
  };

  const onRangeChange = (timeRange: TimeRange) => {
    onClose();
    onChange(timeRange);
  };

  const onRangeClear = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const from = dateTime(null);
    const to = dateTime(null);
    onChange({ from, to, raw: { from, to } });
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.pickerInput}
        aria-label={selectors.components.TimePicker.openButton}
        onClick={onOpen}
      >
        {showIcon && <Icon name="clock-nine" size={'sm'} className={styles.icon} />}

        <TimeRangeLabel value={value} timeZone={timeZone} placeholder={placeholder} />

        {!disabled && (
          <span className={styles.caretIcon}>
            {isValidTimeRange(value) && clearable && (
              <Icon className={styles.clearIcon} name="times" size="lg" onClick={onRangeClear} />
            )}
            <Icon name={isOpen ? 'angle-up' : 'angle-down'} size="lg" />
          </span>
        )}
      </button>
      {isOpen && (
        <ClickOutsideWrapper includeButtonPress={false} onClick={onClose}>
          <TimePickerContent
            timeZone={timeZone}
            value={isValidTimeRange(value) ? value : getDefaultTimeRange()}
            onChange={onRangeChange}
            quickOptions={quickOptions}
            onChangeTimeZone={onChangeTimeZone}
            className={styles.content}
            hideTimeZone={hideTimeZone}
            isReversed={isReversed}
            hideQuickRanges={hideQuickRanges}
          />
        </ClickOutsideWrapper>
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2, disabled = false) => {
  const inputStyles = getInputStyles({ theme, invalid: false });
  return {
    container: css({
      display: 'flex',
      position: 'relative',
    }),
    content: css({
      marginLeft: 0,
      position: 'absolute',
      top: '116%',
      zIndex: theme.zIndex.dropdown,
    }),
    pickerInput: cx(
      inputStyles.input,
      disabled && inputStyles.inputDisabled,
      inputStyles.wrapper,
      css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        paddingRight: 0,
        lineHeight: `${theme.spacing.gridSize * 4 - 2}px`,
      })
    ),
    caretIcon: cx(
      inputStyles.suffix,
      css({
        position: 'relative',
        top: '-1px',
        marginLeft: theme.spacing(0.5),
      })
    ),
    clearIcon: css({
      marginRight: theme.spacing(0.5),
      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
    }),
    placeholder: css({
      color: theme.colors.text.disabled,
      opacity: 1,
    }),
    icon: css({
      marginRight: theme.spacing(0.5),
    }),
  };
});
