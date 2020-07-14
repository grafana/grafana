import React, { FC, FormEvent, useState } from 'react';
import { css, cx } from 'emotion';
import { dateTime, GrafanaTheme, TimeRange, TimeZone } from '@grafana/data';
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

const isValidTimeRange = (range: any) => {
  return isValid(range.from) && isValid(range.to);
};

export interface Props {
  value: TimeRange;
  timeZone?: TimeZone;
  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone?: (timeZone: TimeZone) => void;
  hideTimeZone?: boolean;
  placeholder: string;
}

const noop = () => {};

export const TimeRangeInput: FC<Props> = ({
  value,
  onChange,
  onChangeTimeZone,
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

  return (
    <div className={styles.container}>
      <div tabIndex={0} className={styles.pickerInput} aria-label="TimePicker Open Button" onClick={onOpen}>
        {isValidTimeRange(value) ? (
          <TimePickerButtonLabel value={value} />
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
        <span className={styles.caretIcon}>
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} size="lg" />
        </span>
      </div>
      {isOpen && (
        <ClickOutsideWrapper includeButtonPress={false} onClick={onClose}>
          <TimePickerContent
            timeZone={timeZone}
            value={isValidTimeRange(value) ? value : defaultTimeRange}
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
    placeholder: css`
      color: ${theme.colors.formInputPlaceholderText};
      opacity: 1;
    `,
  };
};
