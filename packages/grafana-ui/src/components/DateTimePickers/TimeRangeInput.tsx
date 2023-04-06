import { css, cx } from '@emotion/css';
import React, { FormEvent, MouseEvent, useState } from 'react';

import { dateMath, dateTime, getDefaultTimeRange, GrafanaTheme2, TimeRange, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { stylesFactory } from '../../themes';
import { useTheme2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../Icon/Icon';
import { getInputStyles } from '../Input/Input';

import { TimePickerButtonLabel } from './TimeRangePicker';
import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { quickOptions } from './options';

const isValidTimeRange = (range: TimeRange) => {
  return dateMath.isValid(range.from) && dateMath.isValid(range.to);
};

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
        {isValidTimeRange(value) ? (
          <TimePickerButtonLabel value={value} timeZone={timeZone} />
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}

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
    container: css`
      display: flex;
      position: relative;
    `,
    content: css`
      margin-left: 0;
      position: absolute;
      top: 116%;
      z-index: ${theme.zIndex.dropdown};
    `,
    pickerInput: cx(
      inputStyles.input,
      disabled && inputStyles.inputDisabled,
      inputStyles.wrapper,
      css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        padding-right: 0;
        line-height: ${theme.spacing.gridSize * 4 - 2}px;
      `
    ),
    caretIcon: cx(
      inputStyles.suffix,
      css`
        position: relative;
        top: -1px;
        margin-left: ${theme.spacing(0.5)};
      `
    ),
    clearIcon: css`
      margin-right: ${theme.spacing(0.5)};
      &:hover {
        color: ${theme.colors.text.maxContrast};
      }
    `,
    placeholder: css`
      color: ${theme.colors.text.disabled};
      opacity: 1;
    `,
    icon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
  };
});
