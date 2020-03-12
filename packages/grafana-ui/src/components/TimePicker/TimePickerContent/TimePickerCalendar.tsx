import React, { memo, useState, useEffect } from 'react';
import { css, cx } from 'emotion';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { GrafanaTheme, dateTime, TIME_FORMAT } from '@grafana/data';
import { stringToDateTimeType } from '../time';
import { useTheme, stylesFactory } from '../../../themes';
import { TimePickerTitle } from './TimePickerTitle';
import Forms from '../../Forms';
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
      color: ${theme.colors.text}
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
        color: ${theme.colors.blueShade};

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
        color: ${theme.colors.white};
        font-weight: ${theme.typography.weight.semibold};
        background: ${theme.colors.blue95};
        box-shadow: none;
        border: 0px;
      }

      .react-calendar__tile--rangeEnd,
      .react-calendar__tile--rangeStart {
        padding: 0;
        border: 0px;
        color: ${theme.colors.white};
        font-weight: ${theme.typography.weight.semibold};
        background: ${theme.colors.blue95};

        abbr {
          background-color: ${theme.colors.blue77};
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
    close: css`
      cursor: pointer;
      font-size: ${theme.typography.size.lg};
    `,
  };
});

interface Props {
  isOpen: boolean;
  from: string;
  to: string;
  onClose: () => void;
  onApply: () => void;
  onChange: (from: string, to: string) => void;
  isFullscreen: boolean;
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
      <i className={cx(styles.close, 'fa', 'fa-times')} onClick={onClose} />
    </div>
  );
});

const Body = memo<Props>(({ onChange, from, to }) => {
  const [value, setValue] = useState<Date[]>();
  const theme = useTheme();
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
      nextLabel={<span className="fa fa-angle-right" />}
      prevLabel={<span className="fa fa-angle-left" />}
      onChange={value => valueToInput(value, onChange)}
      locale="en"
    />
  );
});

const Footer = memo<Props>(({ onClose, onApply }) => {
  const theme = useTheme();
  const styles = getFooterStyles(theme);

  return (
    <div className={styles.container}>
      <Forms.Button className={styles.apply} onClick={onApply}>
        Apply time range
      </Forms.Button>
      <Forms.Button variant="secondary" onClick={onClose}>
        Cancel
      </Forms.Button>
    </div>
  );
});

function inputToValue(from: string, to: string): Date[] {
  const fromAsDateTime = stringToDateTimeType(from);
  const toAsDateTime = stringToDateTimeType(to);
  const fromAsDate = fromAsDateTime.isValid() ? fromAsDateTime.toDate() : new Date();
  const toAsDate = toAsDateTime.isValid() ? toAsDateTime.toDate() : new Date();

  if (fromAsDate > toAsDate) {
    return [toAsDate, fromAsDate];
  }
  return [fromAsDate, toAsDate];
}

function valueToInput(value: Date | Date[], onChange: (from: string, to: string) => void): void {
  const [from, to] = value;
  const fromAsString = dateTime(from).format(TIME_FORMAT);
  const toAsString = dateTime(to).format(TIME_FORMAT);

  return onChange(fromAsString, toAsString);
}
