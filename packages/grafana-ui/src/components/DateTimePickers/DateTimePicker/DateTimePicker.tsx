import React, { FC, FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { useMedia } from 'react-use';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { css, cx } from '@emotion/css';
import { dateTimeFormat, DateTime, dateTime, GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Icon, Input, Portal } from '../..';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { isValid } from '../utils';
import { getBodyStyles, getStyles as getCalendarStyles } from '../TimeRangePicker/TimePickerCalendar';
import { useStyles2, useTheme2 } from '../../../themes';
import { TimeOfDayPicker } from '../TimeOfDayPicker';

export interface Props {
  /** Input date for the component */
  date?: DateTime;
  /** Callback for returning the selected date */
  onChange: (date: DateTime) => void;
  /** label for the input field */
  label?: ReactNode;
}

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export const DateTimePicker: FC<Props> = ({ date, label, onChange }) => {
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
    <div data-testid="date-time-picker">
      <DateTimeInput date={date} onChange={onChange} isFullscreen={isFullscreen} onOpen={onOpen} label={label} />
      {isOpen ? (
        isFullscreen ? (
          <ClickOutsideWrapper onClick={() => setOpen(false)}>
            <DateTimeCalendar date={date} onChange={onApply} isFullscreen={true} />
          </ClickOutsideWrapper>
        ) : (
          <Portal>
            <div className={styles.modal} onClick={stopPropagation}>
              <DateTimeCalendar date={date} onChange={onApply} isFullscreen={false} />
            </div>
            <div className={containerStyles.backdrop} onClick={stopPropagation} />
          </Portal>
        )
      ) : null}
    </div>
  );
};

interface DateTimeCalendarProps {
  date?: DateTime;
  onChange: (date: DateTime) => void;
  isFullscreen: boolean;
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
      setInternalDate((prevState) => ({
        ...prevState,
        value: dateTimeFormat(date),
      }));
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

  const icon = <Button icon="calendar-alt" variant="secondary" onClick={onOpen} />;
  return (
    <Field label={label} onClick={stopPropagation} invalid={internalDate.invalid} error="Incorrect date format">
      <Input
        onClick={stopPropagation}
        onChange={onChangeDate}
        addonAfter={icon}
        value={internalDate.value}
        onFocus={onFocus}
        onBlur={() => onChange(dateTime(internalDate.value))}
        data-testid="date-time-input"
      />
    </Field>
  );
};

const DateTimeCalendar: FC<DateTimeCalendarProps> = ({ date, onChange, isFullscreen }) => {
  const calendarStyles = useStyles2(getBodyStyles);
  const styles = useStyles2(getStyles);
  const [internalDate, setInternalDate] = useState<Date>(() => {
    return date ? date.toDate() : new Date();
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
        prevLabel={<Icon name="angle-left" />}
        onChange={onChangeDate}
        locale="en"
        className={calendarStyles.body}
        tileClassName={calendarStyles.title}
      />
      <div className={styles.time}>
        <TimeOfDayPicker showSeconds={true} onChange={onChangeTime} value={dateTime(internalDate)} />
      </div>
      <div>
        <Button type="button" onClick={() => onChange(dateTime(internalDate))}>
          Apply
        </Button>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    border: 1px ${theme.colors.border.weak} solid;
    border-radius: ${theme.shape.borderRadius(1)};
    background-color: ${theme.colors.background.primary};
  `,
  fullScreen: css`
    position: absolute;
    right: 500px;
    bottom: 400px;
  `,
  time: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  modal: css`
    position: fixed;
    top: 20%;
    left: 10%;
    width: 100%;
    z-index: ${theme.zIndex.modal};
    max-width: 280px;
  `,
});
