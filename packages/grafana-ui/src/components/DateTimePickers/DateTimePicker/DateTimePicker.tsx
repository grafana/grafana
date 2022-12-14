import { css, cx } from '@emotion/css';
import React, { FC, FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import { useMedia } from 'react-use';

import { dateTimeFormat, DateTime, dateTime, GrafanaTheme2, isDateTime } from '@grafana/data';

import { Button, ClickOutsideWrapper, HorizontalGroup, Icon, InlineField, Input, Portal } from '../..';
import { useStyles2, useTheme2 } from '../../../themes';
import { getModalStyles } from '../../Modal/getModalStyles';
import { TimeOfDayPicker } from '../TimeOfDayPicker';
import { getBodyStyles } from '../TimeRangePicker/CalendarBody';
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
}

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export const DateTimePicker: FC<Props> = ({ date, maxDate, label, onChange }) => {
  const [isOpen, setOpen] = useState(false);

  const theme = useTheme2();
  const { modalBackdrop } = getModalStyles(theme);
  const isFullscreen = useMedia(`(min-width: ${theme.breakpoints.values.lg}px)`);
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
      <DateTimeInput date={date} onChange={onChange} isFullscreen={isFullscreen} onOpen={onOpen} label={label} />
      {isOpen ? (
        isFullscreen ? (
          <ClickOutsideWrapper onClick={() => setOpen(false)}>
            <DateTimeCalendar
              date={date}
              onChange={onApply}
              isFullscreen={true}
              onClose={() => setOpen(false)}
              maxDate={maxDate}
            />
          </ClickOutsideWrapper>
        ) : (
          <Portal>
            <ClickOutsideWrapper onClick={() => setOpen(false)}>
              <div className={styles.modal} onClick={stopPropagation}>
                <DateTimeCalendar date={date} onChange={onApply} isFullscreen={false} onClose={() => setOpen(false)} />
              </div>
              <div className={modalBackdrop} onClick={stopPropagation} />
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
}

interface InputProps {
  label?: ReactNode;
  date?: DateTime;
  isFullscreen: boolean;
  onChange: (date: DateTime) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
}

type InputState = {
  value: string;
  invalid: boolean;
};

const DateTimeInput: FC<InputProps> = ({ date, label, onChange, isFullscreen, onOpen }) => {
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

  const icon = <Button aria-label="Time picker" icon="calendar-alt" variant="secondary" onClick={onOpen} />;
  return (
    <InlineField
      label={label}
      onClick={stopPropagation}
      invalid={!!(internalDate.value && internalDate.invalid)}
      className={css`
        margin-bottom: 0;
      `}
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
      />
    </InlineField>
  );
};

const DateTimeCalendar: FC<DateTimeCalendarProps> = ({ date, onClose, onChange, isFullscreen, maxDate }) => {
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
      />
      <div className={styles.time}>
        <TimeOfDayPicker showSeconds={true} onChange={onChangeTime} value={dateTime(internalDate)} />
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
