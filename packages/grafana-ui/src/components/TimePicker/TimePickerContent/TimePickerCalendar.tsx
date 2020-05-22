import React, { memo, useState, useEffect, useCallback } from 'react';
import { css } from 'emotion';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { GrafanaTheme, DateTime, TimeZone, dateTimeParse } from '@grafana/data';
import { useTheme, stylesFactory } from '../../../themes';
import { TimePickerTitle } from './TimePickerTitle';
import { Button } from '../../Button';
import { Icon } from '../../Icon/Icon';
import { Portal } from '../../Portal/Portal';
import { getThemeColors } from './colors';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const colors = getThemeColors(theme);

  return {
    container: css`
      top: 0;
      position: absolute;
      right: 546px;
      box-shadow: 0px 0px 20px ${colors.shadow};
      background-color: ${colors.background};
      z-index: -1;

      &:after {
        display: block;
        background-color: ${colors.background};
        width: 19px;
        height: 381px;
        content: ' ';
        position: absolute;
        top: 0;
        right: -19px;
        border-left: 1px solid ${colors.border};
      }
    `,
    modal: css`
      position: fixed;
      top: 20%;
      width: 100%;
      z-index: ${theme.zIndex.modal};
    `,
    content: css`
      margin: 0 auto;
      width: 268px;
    `,
    backdrop: css`
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      background: #202226;
      opacity: 0.7;
      z-index: ${theme.zIndex.modalBackdrop};
      text-align: center;
    `,
  };
});

const getFooterStyles = stylesFactory((theme: GrafanaTheme) => {
  const colors = getThemeColors(theme);

  return {
    container: css`
      background-color: ${colors.background};
      display: flex;
      justify-content: center;
      padding: 10px;
      align-items: stretch;
    `,
    apply: css`
      margin-right: 4px;
      width: 100%;
      justify-content: center;
    `,
  };
});

const getBodyStyles = stylesFactory((theme: GrafanaTheme) => {
  const colors = getThemeColors(theme);

  return {
    title: css`
      color: ${theme.colors.text};
      background-color: ${colors.background};
      font-size: ${theme.typography.size.md};
      border: 1px solid transparent;

      &:hover {
        position: relative;
      }
    `,
    body: css`
      z-index: ${theme.zIndex.modal};
      background-color: ${colors.background};
      width: 268px;

      .react-calendar__navigation__label,
      .react-calendar__navigation__arrow,
      .react-calendar__navigation {
        padding-top: 4px;
        background-color: inherit;
        color: ${theme.colors.text};
        border: 0;
        font-weight: ${theme.typography.weight.semibold};
      }

      .react-calendar__month-view__weekdays {
        background-color: inherit;
        text-align: center;
        color: ${theme.palette.blue77};

        abbr {
          border: 0;
          text-decoration: none;
          cursor: default;
          display: block;
          padding: 4px 0 4px 0;
        }
      }

      .react-calendar__month-view__days {
        background-color: inherit;
      }

      .react-calendar__tile,
      .react-calendar__tile--now {
        margin-bottom: 4px;
        background-color: inherit;
        height: 26px;
      }

      .react-calendar__navigation__label,
      .react-calendar__navigation > button:focus,
      .time-picker-calendar-tile:focus {
        outline: 0;
      }

      .react-calendar__tile--active,
      .react-calendar__tile--active:hover {
        color: ${theme.palette.white};
        font-weight: ${theme.typography.weight.semibold};
        background: ${theme.palette.blue95};
        box-shadow: none;
        border: 0px;
      }

      .react-calendar__tile--rangeEnd,
      .react-calendar__tile--rangeStart {
        padding: 0;
        border: 0px;
        color: ${theme.palette.white};
        font-weight: ${theme.typography.weight.semibold};
        background: ${theme.palette.blue95};

        abbr {
          background-color: ${theme.palette.blue77};
          border-radius: 100px;
          display: block;
          padding-top: 2px;
          height: 26px;
        }
      }

      .react-calendar__tile--rangeStart {
        border-top-left-radius: 20px;
        border-bottom-left-radius: 20px;
      }

      .react-calendar__tile--rangeEnd {
        border-top-right-radius: 20px;
        border-bottom-right-radius: 20px;
      }
    `,
  };
});

const getHeaderStyles = stylesFactory((theme: GrafanaTheme) => {
  const colors = getThemeColors(theme);

  return {
    container: css`
      background-color: ${colors.background};
      display: flex;
      justify-content: space-between;
      padding: 7px;
    `,
  };
});

interface Props {
  isOpen: boolean;
  from: DateTime;
  to: DateTime;
  onClose: () => void;
  onApply: () => void;
  onChange: (from: DateTime, to: DateTime) => void;
  isFullscreen: boolean;
  timeZone?: TimeZone;
}

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export const TimePickerCalendar = memo<Props>(props => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const { isOpen, isFullscreen } = props;

  if (!isOpen) {
    return null;
  }

  if (isFullscreen) {
    return (
      <ClickOutsideWrapper onClick={props.onClose}>
        <div className={styles.container} onClick={stopPropagation}>
          <Body {...props} />
        </div>
      </ClickOutsideWrapper>
    );
  }

  return (
    <Portal>
      <div className={styles.modal} onClick={stopPropagation}>
        <div className={styles.content}>
          <Header {...props} />
          <Body {...props} />
          <Footer {...props} />
        </div>
      </div>
      <div className={styles.backdrop} onClick={stopPropagation} />
    </Portal>
  );
});

const Header = memo<Props>(({ onClose }) => {
  const theme = useTheme();
  const styles = getHeaderStyles(theme);

  return (
    <div className={styles.container}>
      <TimePickerTitle>Select a time range</TimePickerTitle>
      <Icon name="times" onClick={onClose} />
    </div>
  );
});

const Body = memo<Props>(({ onChange, from, to, timeZone }) => {
  const [value, setValue] = useState<Date[]>();
  const theme = useTheme();
  const onCalendarChange = useOnCalendarChange(onChange, timeZone);
  const styles = getBodyStyles(theme);

  useEffect(() => {
    setValue(inputToValue(from, to));
  }, []);

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
});

const Footer = memo<Props>(({ onClose, onApply }) => {
  const theme = useTheme();
  const styles = getFooterStyles(theme);

  return (
    <div className={styles.container}>
      <Button className={styles.apply} onClick={onApply}>
        Apply time range
      </Button>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
});

function inputToValue(from: DateTime, to: DateTime): Date[] {
  const fromAsDate = from.toDate();
  const toAsDate = to.toDate();

  if (fromAsDate > toAsDate) {
    return [toAsDate, fromAsDate];
  }
  return [fromAsDate, toAsDate];
}

function useOnCalendarChange(onChange: (from: DateTime, to: DateTime) => void, timeZone?: TimeZone) {
  return useCallback(
    (value: Date | Date[]) => {
      if (!Array.isArray(value)) {
        return console.error('onCalendarChange: should be run in selectRange={true}');
      }

      const from = dateTimeParse(dateInfo(value[0]), { timeZone });
      const to = dateTimeParse(dateInfo(value[1]), { timeZone });

      onChange(from, to);
    },
    [onChange]
  );
}

function dateInfo(date: Date): number[] {
  return [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
}
