import React, { FC, FormEvent, MouseEvent, useState } from 'react';
import { css, cx } from 'emotion';
import { DateTime, dateTime, GrafanaTheme, RawTimeRange, TimeRange, TimeZone } from '@grafana/data';
import { useStyles } from '../../themes/ThemeContext';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../Icon/Icon';
import { getInputStyles } from '../Input/Input';
import { getFocusStyle } from '../Forms/commonStyles';
import { TimePickerButtonLabel } from './TimeRangePicker';
import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { otherOptions, quickOptions } from './rangeOptions';
import { isValid } from './TimeRangePicker/TimeRangeForm';

export const defaultTimeRange: TimeRange = {
  from: dateTime().subtract(6, 'hour'),
  to: dateTime(),
  raw: { from: 'now-6h', to: 'now' },
};

export interface InputTimeRange {
  from: DateTime | string;
  to: DateTime | string;
  raw: RawTimeRange;
}

const isValidTimeRange = (range: any) => {
  return isValid(range.from) && isValid(range.to);
};

export interface Props {
  value: InputTimeRange;
  timeZone?: TimeZone;
  onChange: (timeRange: InputTimeRange) => void;
  onChangeTimeZone?: (timeZone: TimeZone) => void;
  hideTimeZone?: boolean;
  placeholder?: string;
  clearable?: boolean;
}

const noop = () => {};

export const TimeRangeInput: FC<Props> = ({
  value,
  onChange,
  onChangeTimeZone,
  clearable,
  hideTimeZone = true,
  timeZone = 'browser',
  placeholder = 'Select time range',
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
    const from = '';
    const to = '';
    onChange({ from, to, raw: { from, to } });
  };

  return (
    <div className={styles.container}>
      <div tabIndex={0} className={styles.pickerInput} aria-label="TimePicker Open Button" onClick={onOpen}>
        {isValidTimeRange(value) ? (
          <TimePickerButtonLabel value={value as TimeRange} />
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
            value={isValidTimeRange(value) ? (value as TimeRange) : defaultTimeRange}
            onChange={onRangeChange}
            otherOptions={otherOptions}
            quickOptions={quickOptions}
            onChangeTimeZone={onChangeTimeZone || noop}
            className={styles.content}
            hideTimeZone={hideTimeZone}
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
        color: ${theme.palette.white};
      }
    `,
    placeholder: css`
      color: ${theme.colors.formInputPlaceholderText};
      opacity: 1;
    `,
  };
};
