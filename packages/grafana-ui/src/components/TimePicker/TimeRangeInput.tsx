import React, { FC, FormEvent, MouseEvent, useState } from 'react';
import { css, cx } from '@emotion/css';
import { dateMath, dateTime, getDefaultTimeRange, GrafanaTheme2, TimeRange, TimeZone } from '@grafana/data';
import { useTheme2 } from '../../themes/ThemeContext';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../Icon/Icon';
import { getInputStyles } from '../Input/Input';
import { TimePickerButtonLabel } from './TimeRangePicker';
import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { otherOptions, quickOptions } from './rangeOptions';
import { selectors } from '@grafana/e2e-selectors';
import { stylesFactory } from '../../themes';

const isValidTimeRange = (range: any) => {
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
  isReversed?: boolean;
  hideQuickRanges?: boolean;
  disabled?: boolean;
}

const noop = () => {};

export const TimeRangeInput: FC<TimeRangeInputProps> = ({
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme2();
  const styles = getStyles(theme, disabled);

  const onOpen = (event: FormEvent<HTMLDivElement>) => {
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
      <div
        tabIndex={0}
        className={styles.pickerInput}
        aria-label={selectors.components.TimePicker.openButton}
        onClick={onOpen}
      >
        {isValidTimeRange(value) ? (
          <TimePickerButtonLabel value={value as TimeRange} timeZone={timeZone} />
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
      </div>
      {isOpen && (
        <ClickOutsideWrapper includeButtonPress={false} onClick={onClose}>
          <TimePickerContent
            timeZone={timeZone}
            value={isValidTimeRange(value) ? (value as TimeRange) : getDefaultTimeRange()}
            onChange={onRangeChange}
            otherOptions={otherOptions}
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
        line-height: ${theme.v1.spacing.formInputHeight - 2}px;
      `
    ),
    caretIcon: cx(
      inputStyles.suffix,
      css`
        position: relative;
        margin-left: ${theme.v1.spacing.xs};
      `
    ),
    clearIcon: css`
      margin-right: ${theme.v1.spacing.xs};
      &:hover {
        color: ${theme.v1.colors.linkHover};
      }
    `,
    placeholder: css`
      color: ${theme.v1.colors.formInputPlaceholderText};
      opacity: 1;
    `,
  };
});
