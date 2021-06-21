import React, { FC, FormEvent, ReactNode, useCallback, useState } from 'react';
import { useMedia } from 'react-use';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { css } from '@emotion/css';
import { dateTimeFormat, DateTime, dateTime, GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Icon, Input, Portal } from '../..';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { getBodyStyles, getStyles as getCalendarStyles } from '../TimeRangePicker/TimePickerCalendar';
import { useStyles2, useTheme2 } from '../../../themes';
import { TimeOfDayPicker } from '../TimeOfDayPicker';

export interface Props {
  label: ReactNode;
  date: DateTime;
  onChange: (date: DateTime) => void;
}

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export const DateTimePicker: FC<Props> = ({ date, label, onChange }) => {
  const [isOpen, setOpen] = useState(false);
  const theme = useTheme2();
  const isFullscreen = useMedia(`(min-width: ${theme.breakpoints.values.lg}px)`);
  const containerStyles = useStyles2(getCalendarStyles);

  const onApply = (date: DateTime) => {
    setOpen(false);
    onChange(date);
  };

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      event.preventDefault();
      setOpen(true);
    },
    [setOpen]
  );

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
  console.log(isOpen);
  return (
    <>
      <Field label={label}>
        <Input
          onClick={stopPropagation}
          onChange={() => {}}
          addonAfter={icon}
          value={dateTimeFormat(date)}
          onFocus={onFocus}
        />
      </Field>
      {isOpen &&
        (isFullscreen ? (
          <ClickOutsideWrapper
            onClick={() => {
              setOpen(false);
            }}
          >
            <DateTimeCalendar date={date} onChange={onApply} />
          </ClickOutsideWrapper>
        ) : (
          <Portal>
            <div className={containerStyles.modal} onClick={stopPropagation}>
              <DateTimeCalendar date={date} onChange={onApply} />
            </div>
            <div className={containerStyles.backdrop} onClick={stopPropagation} />
          </Portal>
        ))}
    </>
  );
};

interface DateTimeCalendarProps {
  date: DateTime;
  onChange: (date: DateTime) => void;
}

const DateTimeCalendar: FC<DateTimeCalendarProps> = ({ date, onChange }) => {
  const calendarStyles = useStyles2(getBodyStyles);
  const styles = useStyles2(getStyles);
  const [internalDate, setInternalDate] = useState<Date>(date.toDate() || Date.now());

  return (
    <div className={styles.container} onClick={stopPropagation}>
      <Calendar
        next2Label={null}
        prev2Label={null}
        value={internalDate}
        nextLabel={<Icon name="angle-right" />}
        prevLabel={<Icon name="angle-left" />}
        onChange={(date) => {
          if (!Array.isArray(date)) {
            setInternalDate(date);
          }
        }}
        locale="en"
        className={calendarStyles.body}
        tileClassName={calendarStyles.title}
      />
      <div className={styles.time}>
        <TimeOfDayPicker
          showSeconds={true}
          onChange={(date) => setInternalDate(date.toDate())}
          value={dateTime(internalDate)}
        />
      </div>
      <div>
        <Button onClick={() => onChange(dateTime(internalDate))}>Apply</Button>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    border: 1px ${theme.colors.border.weak} solid;
    border-radius: ${theme.shape.borderRadius(1)};
  `,
  time: css`
    margin-bottom: ${theme.spacing(2)};
  `,
});
