import React, { FC, FormEvent, MouseEvent, useState } from 'react';
import { css, cx } from 'emotion';
import { dateMath, dateTime, getDefaultTimeRange, GrafanaTheme, TimeRange, TimeZone } from '@grafana/data';
import { useStyles } from '../../themes/ThemeContext';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../Icon/Icon';
import { getInputStyles } from '../Input/Input';
import { getFocusStyle } from '../Forms/commonStyles';
import { TimePickerButtonLabel } from './TimeRangePicker';
import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { otherOptions, quickOptions } from './rangeOptions';

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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles(getStyles);

  const onOpen = (event: FormEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
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
      <div tabIndex={0} className={styles.pickerInput} aria-label="TimePicker Open Button" onClick={onOpen}>
        {isValidTimeRange(value) ? (
          <TimePickerButtonLabel value={value as TimeRange} timeZone={timeZone} />
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}

        <span className={styles.caretIcon}>
          {isValidTimeRange(value) && clearable && (
            <Icon className={styles.clearIcon} name="times" size="lg" onClick={onRangeClear} />
          )}
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} size="lg" />
        </span>
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

const getStyles = (theme: GrafanaTheme) => {
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
      inputStyles.wrapper,
      css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        padding-right: 0;
        line-height: ${theme.spacing.formInputHeight - 2}px;
        ${getFocusStyle(theme)};
      `
    ),
    caretIcon: cx(
      inputStyles.suffix,
      css`
        position: relative;
        margin-left: ${theme.spacing.xs};
      `
    ),
    clearIcon: css`
      margin-right: ${theme.spacing.xs};
      &:hover {
        color: ${theme.colors.linkHover};
      }
    `,
    placeholder: css`
      color: ${theme.colors.formInputPlaceholderText};
      opacity: 1;
    `,
  };
};
