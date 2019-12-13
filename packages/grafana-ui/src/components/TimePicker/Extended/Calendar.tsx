import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme, TimeRange, dateTime } from '@grafana/data';
import { css } from 'emotion';
import TimeRangeTitle from './TimeRangeTitle';
import Calendar from 'react-calendar/dist/entry.nostyle';
import Forms from '../../Forms';

const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
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
    calendar: css`
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
    calendarTitle: css`
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
    calendarBody: css`
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
    calendarHeader: css`
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
    calendarFooter: css`
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
  visible: boolean;
  selected?: TimeRange;
  onChange: (timeRange: TimeRange) => void;
}

const TimePickerCalendar: React.FC<Props> = ({ selected, onChange, visible }: Props) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);

  if (!visible) {
    return null;
  }

  return (
    <div className={styles.background}>
      <div className={styles.calendar}>
        <div className={styles.calendarHeader}>
          <TimeRangeTitle>Select a time range</TimeRangeTitle>
          <i className="fa fa-times" />
        </div>
        <Calendar
          selectRange={true}
          next2Label={null}
          prev2Label={null}
          className={styles.calendarBody}
          tileClassName={styles.calendarTitle}
          value={toCalendarDate(selected)}
          nextLabel={<span className="fa fa-angle-right" />}
          prevLabel={<span className="fa fa-angle-left" />}
          onChange={value => onChange(onCalendarChange(value))}
        />
        <div className={styles.calendarFooter}>
          <Forms.Button
            className={css`
              margin-right: 4px;
              width: 100%;
              justify-content: center;
            `}
          >
            Apply time range
          </Forms.Button>
          <Forms.Button variant="secondary">Cancel</Forms.Button>
        </div>
      </div>
    </div>
  );
};

function toCalendarDate(selected?: TimeRange): Date[] | Date {
  if (!selected) {
    return new Date();
  }
  return [selected.from.toDate(), selected.to.toDate()];
}

function onCalendarChange(value: Date | Date[]): TimeRange {
  const [from, to] = value;

  return {
    from: dateTime(from),
    to: dateTime(to),
    raw: { from: dateTime(from), to: dateTime(to) },
  };
}

export default TimePickerCalendar;
