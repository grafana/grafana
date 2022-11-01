import { css, cx } from '@emotion/css';
import { TimePickerProps } from 'rc-time-picker';
import React, { FC, FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import Calendar, { CalendarProps } from 'react-calendar';
import { useMedia } from 'react-use';

import { dateTimeFormat, DateTime, dateTime, GrafanaTheme2, isDateTime } from '@grafana/data';

import { Button, ClickOutsideWrapper, HorizontalGroup, Icon, InlineField, Input, Portal } from '../..';
import { useStyles2, useTheme2 } from '../../../themes';
import { TimeOfDayPicker } from '../TimeOfDayPicker';
import { getBodyStyles } from '../TimeRangePicker/CalendarBody';
import { getStyles as getCalendarStyles } from '../TimeRangePicker/TimePickerCalendar';
import { isValid } from '../utils';

export interface Props {
  /** Input date for the component */
  date?: DateTime;
  /** Callback for returning the selected date */
  onChange: (date: DateTime) => void;
  /** label for the input field */
  label?: ReactNode;
  /** Set the latest selectable date */
  maxDate?: Date;
  // @PERCONA
  calendarProps?: CalendarProps;
  timepickerProps?: TimePickerProps;
  inputWrapperClassName?: string;
  growInlineField?: boolean;
  shrinkInlineField?: boolean;
}

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export const DateTimePicker: FC<Props> = ({
  date,
  maxDate,
  label,
  onChange,
  calendarProps,
  timepickerProps,
  inputWrapperClassName,
  growInlineField,
  shrinkInlineField,
}) => {
  const [isOpen, setOpen] = useState(false);

  const theme = useTheme2();
  const isFullscreen = useMedia(`(min-width: ${theme.breakpoints.values.lg}px)`);
  const containerStyles = useStyles2(getCalendarStyles);
  const styles = useStyles2(getStyles);

  const onApply = useCallback(
    (date: DateTime) => {
      setOpen(false);
      onChange(date);
    },
    [onChange]
  );

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      event.preventDefault();
      setOpen(true);
    },
    [setOpen]
  );

  return (
    <div data-testid="date-time-picker" style={{ position: 'relative' }}>
      <DateTimeInput
        growInlineField={growInlineField}
        shrinkInlineField={shrinkInlineField}
        inputWrapperClassName={inputWrapperClassName}
        date={date}
        onChange={onChange}
        isFullscreen={isFullscreen}
        onOpen={onOpen}
        label={label}
      />
      {isOpen ? (
        isFullscreen ? (
          <ClickOutsideWrapper onClick={() => setOpen(false)}>
            <DateTimeCalendar
              date={date}
              onChange={onApply}
              isFullscreen={true}
              onClose={() => setOpen(false)}
              maxDate={maxDate}
              calendarProps={calendarProps}
              timepickerProps={timepickerProps}
            />
          </ClickOutsideWrapper>
        ) : (
          <Portal>
            <ClickOutsideWrapper onClick={() => setOpen(false)}>
              <div className={styles.modal} onClick={stopPropagation}>
                <DateTimeCalendar
                  date={date}
                  onChange={onApply}
                  isFullscreen={false}
                  onClose={() => setOpen(false)}
                  calendarProps={calendarProps}
                  timepickerProps={timepickerProps}
                />
              </div>
              <div className={containerStyles.backdrop} onClick={stopPropagation} />
            </ClickOutsideWrapper>
          </Portal>
        )
      ) : null}
    </div>
  );
};

interface DateTimeCalendarProps {
  date?: DateTime;
  onChange: (date: DateTime) => void;
  onClose: () => void;
  isFullscreen: boolean;
  maxDate?: Date;
  // @PERCONA
  calendarProps?: CalendarProps;
  timepickerProps?: TimePickerProps;
}

interface InputProps {
  label?: ReactNode;
  date?: DateTime;
  isFullscreen: boolean;
  onChange: (date: DateTime) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
  inputWrapperClassName?: string;
  growInlineField?: boolean;
  shrinkInlineField?: boolean;
}

type InputState = {
  value: string;
  invalid: boolean;
};

const DateTimeInput: FC<InputProps> = ({
  date,
  label,
  onChange,
  isFullscreen,
  onOpen,
  inputWrapperClassName,
  growInlineField,
  shrinkInlineField,
}) => {
  const [internalDate, setInternalDate] = useState<InputState>(() => {
    return { value: date ? dateTimeFormat(date) : dateTimeFormat(dateTime()), invalid: false };
  });

  useEffect(() => {
    if (date) {
      setInternalDate({
        invalid: !isValid(dateTimeFormat(date)),
        value: isDateTime(date) ? dateTimeFormat(date) : date,
      });
    }
  }, [date]);

  const onChangeDate = useCallback((event: FormEvent<HTMLInputElement>) => {
    const isInvalid = !isValid(event.currentTarget.value);
    setInternalDate({
      value: event.currentTarget.value,
      invalid: isInvalid,
    });
  }, []);

  const onFocus = useCallback(
    (event: FormEvent<HTMLElement>) => {
      if (!isFullscreen) {
        return;
      }
      onOpen(event);
    },
    [isFullscreen, onOpen]
  );

  const onBlur = useCallback(() => {
    if (isDateTime(internalDate.value)) {
      onChange(dateTime(internalDate.value));
    }
  }, [internalDate.value, onChange]);

  const icon = (
    <Button
      className={css`
        height: 100%;
      `}
      aria-label="Time picker"
      icon="calendar-alt"
      variant="secondary"
      onClick={onOpen}
    />
  );
  return (
    <InlineField
      label={label}
      onClick={stopPropagation}
      invalid={!!(internalDate.value && internalDate.invalid)}
      className={css`
        margin-bottom: 0;
      `}
      grow={growInlineField}
      shrink={shrinkInlineField}
    >
      <Input
        onClick={stopPropagation}
        onChange={onChangeDate}
        addonAfter={icon}
        value={internalDate.value}
        onFocus={onFocus}
        onBlur={onBlur}
        data-testid="date-time-input"
        placeholder="Select date/time"
        className={inputWrapperClassName}
      />
    </InlineField>
  );
};

const DateTimeCalendar: FC<DateTimeCalendarProps> = ({
  date,
  onClose,
  onChange,
  isFullscreen,
  maxDate,
  calendarProps,
  timepickerProps,
}) => {
  const calendarStyles = useStyles2(getBodyStyles);
  const styles = useStyles2(getStyles);
  const [internalDate, setInternalDate] = useState<Date>(() => {
    if (date && date.isValid()) {
      return date.toDate();
    }

    return new Date();
  });

  const onChangeDate = useCallback((date: Date | Date[]) => {
    if (!Array.isArray(date)) {
      setInternalDate((prevState) => {
        // If we don't use time from prevState
        // the time will be reset to 00:00:00
        date.setHours(prevState.getHours());
        date.setMinutes(prevState.getMinutes());
        date.setSeconds(prevState.getSeconds());

        return date;
      });
    }
  }, []);

  const onChangeTime = useCallback((date: DateTime) => {
    setInternalDate(date.toDate());
  }, []);

  useEffect(() => {
    if (date?.isValid()) {
      setInternalDate(date.toDate());
    }
  }, [date]);

  return (
    <div className={cx(styles.container, { [styles.fullScreen]: isFullscreen })} onClick={stopPropagation}>
      <Calendar
        next2Label={null}
        prev2Label={null}
        value={internalDate}
        nextLabel={<Icon name="angle-right" />}
        nextAriaLabel="Next month"
        prevLabel={<Icon name="angle-left" />}
        prevAriaLabel="Previous month"
        onChange={onChangeDate}
        locale="en"
        className={calendarStyles.body}
        tileClassName={calendarStyles.title}
        maxDate={maxDate}
        {...calendarProps}
      />
      <div className={styles.time}>
        <TimeOfDayPicker
          showSeconds={true}
          onChange={onChangeTime}
          value={dateTime(internalDate)}
          timepickerProps={timepickerProps}
        />
      </div>
      <HorizontalGroup>
        <Button type="button" onClick={() => onChange(dateTime(internalDate))}>
          Apply
        </Button>
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
      </HorizontalGroup>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    border: 1px ${theme.colors.border.weak} solid;
    border-radius: ${theme.shape.borderRadius(1)};
    background-color: ${theme.colors.background.primary};
    z-index: ${theme.zIndex.modal};
  `,
  fullScreen: css`
    position: absolute;
  `,
  time: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  modal: css`
    position: fixed;
    top: 25%;
    left: 25%;
    width: 100%;
    z-index: ${theme.zIndex.modal};
    max-width: 280px;
  `,
});
