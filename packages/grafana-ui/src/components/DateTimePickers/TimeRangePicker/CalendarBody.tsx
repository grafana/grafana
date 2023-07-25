import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import Calendar from 'react-calendar';

import { GrafanaTheme2, dateTime, dateTimeParse, DateTime, TimeZone } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { Icon } from '../../Icon/Icon';

import { TimePickerCalendarProps } from './TimePickerCalendar';

export function Body({ onChange, from, to, timeZone }: TimePickerCalendarProps) {
  const value = inputToValue(from, to);
  const onCalendarChange = useOnCalendarChange(onChange, timeZone);
  const styles = useStyles2(getBodyStyles);

  return (
    <Calendar
      selectRange={true}
      next2Label={null}
      prev2Label={null}
      className={styles.body}
      tileClassName={styles.title}
      value={value}
      nextLabel={<Icon name="angle-right" />}
      prevLabel={<Icon name="angle-left" />}
      onChange={onCalendarChange}
      locale="en"
    />
  );
}

Body.displayName = 'Body';

export function inputToValue(from: DateTime, to: DateTime, invalidDateDefault: Date = new Date()): [Date, Date] {
  const fromAsDate = from.toDate();
  const toAsDate = to.toDate();
  const fromAsValidDate = dateTime(fromAsDate).isValid() ? fromAsDate : invalidDateDefault;
  const toAsValidDate = dateTime(toAsDate).isValid() ? toAsDate : invalidDateDefault;

  if (fromAsValidDate > toAsValidDate) {
    return [toAsValidDate, fromAsValidDate];
  }
  return [fromAsValidDate, toAsValidDate];
}

function useOnCalendarChange(onChange: (from: DateTime, to: DateTime) => void, timeZone?: TimeZone) {
  return useCallback<NonNullable<React.ComponentProps<typeof Calendar>['onChange']>>(
    (value) => {
      if (!Array.isArray(value)) {
        return console.error('onCalendarChange: should be run in selectRange={true}');
      }

      if (value[0] && value[1]) {
        const from = dateTimeParse(dateInfo(value[0]), { timeZone });
        const to = dateTimeParse(dateInfo(value[1]), { timeZone });

        onChange(from, to);
      }
    },
    [onChange, timeZone]
  );
}

function dateInfo(date: Date): number[] {
  return [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
}

export const getBodyStyles = (theme: GrafanaTheme2) => {
  // If a time range is part of only 1 day but does not encompass the whole day,
  // the class that react-calendar uses is '--hasActive' by itself (without being part of a '--range')
  const hasActiveSelector = `.react-calendar__tile--hasActive:not(.react-calendar__tile--range)`;
  return {
    title: css({
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.primary,
      fontSize: theme.typography.size.md,
      border: '1px solid transparent',

      '&:hover': {
        position: 'relative',
      },

      '&:disabled': {
        color: theme.colors.action.disabledText,
      },
    }),
    body: css({
      zIndex: theme.zIndex.modal,
      backgroundColor: theme.colors.background.primary,
      width: '268px',

      '.react-calendar__navigation': {
        display: 'flex',
      },

      '.react-calendar__navigation__label, .react-calendar__navigation__arrow, .react-calendar__navigation': {
        paddingTop: '4px',
        backgroundColor: 'inherit',
        color: theme.colors.text.primary,
        border: 0,
        fontWeight: theme.typography.fontWeightMedium,
      },

      '.react-calendar__month-view__weekdays': {
        backgroundColor: 'inherit',
        textAlign: 'center',
        color: theme.colors.primary.text,

        abbr: {
          border: 0,
          textDecoration: 'none',
          cursor: 'default',
          display: 'block',
          padding: '4px 0 4px 0',
        },
      },

      '.react-calendar__month-view__days': {
        backgroundColor: 'inherit',
      },

      '.react-calendar__tile, .react-calendar__tile--now': {
        marginBottom: '4px',
        backgroundColor: 'inherit',
        height: '26px',
      },

      '.react-calendar__navigation__label, .react-calendar__navigation > button:focus, .time-picker-calendar-tile:focus':
        {
          outline: 0,
        },

      [`${hasActiveSelector}, .react-calendar__tile--active, .react-calendar__tile--active:hover`]: {
        color: theme.colors.primary.contrastText,
        fontWeight: theme.typography.fontWeightMedium,
        background: theme.colors.primary.main,
        boxShadow: 'none',
        border: '0px',
      },

      '.react-calendar__tile--rangeEnd, .react-calendar__tile--rangeStart': {
        padding: 0,
        border: '0px',
        color: theme.colors.primary.contrastText,
        fontWeight: theme.typography.fontWeightMedium,
        background: theme.colors.primary.main,

        abbr: {
          backgroundColor: theme.colors.primary.main,
          borderRadius: '100px',
          display: 'block',
          paddingTop: '2px',
          height: '26px',
        },
      },

      [`${hasActiveSelector}, .react-calendar__tile--rangeStart`]: {
        borderTopLeftRadius: '20px',
        borderBottomLeftRadius: '20px',
      },

      [`${hasActiveSelector}, .react-calendar__tile--rangeEnd`]: {
        borderTopRightRadius: '20px',
        borderBottomRightRadius: '20px',
      },
    }),
  };
};
