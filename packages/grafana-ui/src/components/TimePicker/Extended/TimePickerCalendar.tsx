import React, { ReactNode } from 'react';
import { css, cx } from 'emotion';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { GrafanaTheme, TimeRange, dateTime } from '@grafana/data';
import { useTheme, stylesFactory } from '../../../themes';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    background: css`
      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: rgb(32, 34, 38, 0.7);
        z-index: ${theme.zIndex.modalBackdrop};
      }
    `,
    container: css`
      top: 0;
      position: absolute;
      right: 546px;
      box-shadow: 0px 4px 4px #c7d0d9;

      @media only screen and (min-width: ${theme.breakpoints.lg}) {
        &:after {
          display: block;
          background-color: ${theme.background.dropdown};
          width: 4px;
          height: 221px;
          content: ' ';
          position: absolute;
          top: 0;
          right: -3px;
          border-left: 1px solid ${theme.colors.gray4};
        }
      }

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        position: static;
        margin: 20% auto;
        z-index: ${theme.zIndex.modal};
        width: 268px;
        box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.6);
      }
    `,
    title: css`
      color: ${theme.colors.text}
      background-color: inherit;
      line-height: 21px;
      font-size: ${theme.typography.size.md};
      border: 1px solid transparent;

      &:hover {
        box-shadow: $panel-editor-viz-item-shadow-hover;
        background: $panel-editor-viz-item-bg-hover;
        border: $panel-editor-viz-item-border-hover;
        color: $text-color-strong;
        position: relative;
      }
    `,
    body: css`
      background-color: white;
      width: 268px;

      .react-calendar__navigation__label,
      .react-calendar__navigation__arrow,
      .react-calendar__navigation {
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
          color: $orange;
          font-weight: $font-weight-semi-bold;
          display: block;
          padding: 4px 0 0 0;
        }
      }

      .react-calendar__month-view__days {
        background-color: inherit;
      }

      .react-calendar__tile--now {
        background-color: inherit;
      }

      .react-calendar__navigation__label,
      .react-calendar__navigation > button:focus,
      .time-picker-calendar-tile:focus {
        outline: 0;
      }

      .react-calendar__tile--now {
        border-radius: $border-radius;
      }

      .react-calendar__tile--active,
      .react-calendar__tile--active:hover {
        color: ${theme.colors.white};
        font-weight: ${theme.typography.weight.semibold};
        background: #5794f2;
        box-shadow: none;
        border: 0px;
      }

      .react-calendar__tile--rangeEnd,
      .react-calendar__tile--rangeStart {
        padding: 0;
        border: 0px;
        color: ${theme.colors.white};
        font-weight: ${theme.typography.weight.semibold};
        background: #5794f2;

        abbr {
          background-color: #1f60c4;
          border-radius: 100px;
          display: block;
          padding: 2px 7px 3px;
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
    header: css`
      @media only screen and (min-width: ${theme.breakpoints.lg}) {
        display: none;
      }

      background-color: ${theme.background.dropdown};
      display: flex;
      justify-content: space-between;
      padding: 7px;

      i {
        font-size: ${theme.typography.size.lg};
      }
    `,
    footer: css`
      @media only screen and (min-width: ${theme.breakpoints.lg}) {
        display: none;
      }

      background-color: ${theme.background.dropdown};
      display: flex;
      justify-content: center;
      padding: 10px;
      align-items: stretch;
    `,
  };
});

interface Props {
  value?: TimeRange;
  onChange: (value: TimeRange) => void;
  header?: ReactNode;
  headerClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
}

const TimePickerCalendar: React.FC<Props> = props => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const { value, onChange, header, footer, headerClassName, footerClassName } = props;

  return (
    <div className={styles.background}>
      <div className={styles.container}>
        <div className={cx(styles.header, headerClassName)}>{header}</div>
        <Calendar
          selectRange={true}
          next2Label={null}
          prev2Label={null}
          className={styles.body}
          tileClassName={styles.title}
          value={rangeToValue(value)}
          nextLabel={<span className="fa fa-angle-right" />}
          prevLabel={<span className="fa fa-angle-left" />}
          onChange={value => onChange(valueToRange(value))}
        />
        <div className={cx(styles.footer, footerClassName)}>{footer}</div>
      </div>
    </div>
  );
};

function rangeToValue(selected?: TimeRange): Date[] | Date {
  if (!selected) {
    return new Date();
  }
  const { from, to } = selected;
  return [from.toDate(), to.toDate()];
}

function valueToRange(value: Date | Date[]): TimeRange {
  const [fromValue, toValue] = value;

  const from = dateTime(fromValue);
  const to = dateTime(toValue);

  return {
    from,
    to,
    raw: { from, to },
  };
}

export default TimePickerCalendar;
