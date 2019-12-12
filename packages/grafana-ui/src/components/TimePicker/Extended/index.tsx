import React, { useState } from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme, TimeOption, TimeRange } from '@grafana/data';
import { css } from 'emotion';
import TimeRangeTitle from './TimeRangeTitle';
import TimeRangeForm from './TimeRangeForm';
import { CustomScrollbar } from '../../CustomScrollbar/CustomScrollbar';
import TimeRangeList from './TimeRangeList';
import Calendar from 'react-calendar/dist/entry.nostyle';
import Forms from '../../Forms';
import { style } from 'd3';

const defaultSelectOptions: TimeOption[] = [
  { from: 'now-5m', to: 'now', display: 'Last 5 minutes', section: 3 },
  { from: 'now-15m', to: 'now', display: 'Last 15 minutes', section: 3 },
  { from: 'now-30m', to: 'now', display: 'Last 30 minutes', section: 3 },
  { from: 'now-1h', to: 'now', display: 'Last 1 hour', section: 3 },
  { from: 'now-3h', to: 'now', display: 'Last 3 hours', section: 3 },
  { from: 'now-6h', to: 'now', display: 'Last 6 hours', section: 3 },
  { from: 'now-12h', to: 'now', display: 'Last 12 hours', section: 3 },
  { from: 'now-24h', to: 'now', display: 'Last 24 hours', section: 3 },
  { from: 'now-2d', to: 'now', display: 'Last 2 days', section: 3 },
  { from: 'now-7d', to: 'now', display: 'Last 7 days', section: 3 },
  { from: 'now-30d', to: 'now', display: 'Last 30 days', section: 3 },
  { from: 'now-90d', to: 'now', display: 'Last 90 days', section: 3 },
  { from: 'now-6M', to: 'now', display: 'Last 6 months', section: 3 },
  { from: 'now-1y', to: 'now', display: 'Last 1 year', section: 3 },
  { from: 'now-2y', to: 'now', display: 'Last 2 years', section: 3 },
  { from: 'now-5y', to: 'now', display: 'Last 5 years', section: 3 },
  { from: 'now-1d/d', to: 'now-1d/d', display: 'Yesterday', section: 3 },
  { from: 'now-2d/d', to: 'now-2d/d', display: 'Day before yesterday', section: 3 },
  { from: 'now-7d/d', to: 'now-7d/d', display: 'This day last week', section: 3 },
  { from: 'now-1w/w', to: 'now-1w/w', display: 'Previous week', section: 3 },
  { from: 'now-1M/M', to: 'now-1M/M', display: 'Previous month', section: 3 },
  { from: 'now-1y/y', to: 'now-1y/y', display: 'Previous year', section: 3 },
  { from: 'now/d', to: 'now/d', display: 'Today', section: 3 },
  { from: 'now/d', to: 'now', display: 'Today so far', section: 3 },
  { from: 'now/w', to: 'now/w', display: 'This week', section: 3 },
  { from: 'now/w', to: 'now', display: 'This week so far', section: 3 },
  { from: 'now/M', to: 'now/M', display: 'This month', section: 3 },
  { from: 'now/M', to: 'now', display: 'This month so far', section: 3 },
  { from: 'now/y', to: 'now/y', display: 'This year', section: 3 },
  { from: 'now/y', to: 'now', display: 'This year so far', section: 3 },
];

const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      background: ${theme.background.dropdown};
      box-shadow: 0px 4px 4px #c7d0d9;
      position: absolute;
      z-index: ${theme.zIndex.modal};
      width: 546px;
      height: 381px;
      top: 34px;
      right: 32px;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        width: 218px;
      }
    `,
    leftSide: css`
      display: flex;
      flex-direction: column;
      border-right: 1px solid ${theme.colors.gray4};
      width: 60%;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        display: none;
      }
    `,
    rightSide: css`
      width: 40% !important;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        width: 100% !important;
      }
    `,
    fullscreenForm: css`
      padding-top: 9px;
      padding-left: 11px;
      padding-right: 20%;
    `,
    recentRanges: css`
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    `,
    narrowscreenForm: css`
      display: none;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        display: block;
      }
    `,
    accordionHeader: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid ${theme.colors.gray4};
      padding: 6px 9px 6px 9px;
    `,
    accordionBody: css`
      border-bottom: 1px solid ${theme.colors.gray4};
      background: #f7f8fa;
      box-shadow: inset 0px 2px 2px rgba(199, 208, 217, 0.5);
    `,
    narrowForm: css`
      padding: 6px 9px 6px 9px;
    `,
    calendar: css`
      position: absolute;
      right: 546px;
      box-shadow: 0px 4px 4px #c7d0d9;
      z-index: -1;

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
        right: 218px;
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
  selected: TimeRange;
  onChange: (timeRange: TimeRange) => void;
}

const ExtendedTimePicker: React.FC<Props> = ({ selected, onChange }: Props) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.leftSide}>
        <div className={styles.fullscreenForm}>
          <div
            className={css`
              margin-bottom: 11px;
            `}
          >
            <TimeRangeTitle>Absolute time range</TimeRangeTitle>
          </div>
          <TimeRangeForm value={selected} onApply={onChange} />
        </div>
        <div className={styles.recentRanges}>
          <TimeRangeList
            title="Recently used absolute ranges"
            options={defaultSelectOptions.slice(0, 4)}
            onSelect={onChange}
            selected={selected}
          />
        </div>
      </div>
      <CustomScrollbar className={styles.rightSide}>
        <div className={styles.narrowscreenForm}>
          <div className={styles.accordionHeader} onClick={() => setCollapsed(!collapsed)}>
            <TimeRangeTitle>Absolute time range</TimeRangeTitle>
            {collapsed ? <i className="fa fa-caret-up" /> : <i className="fa fa-caret-down" />}
          </div>
          {collapsed && (
            <div className={styles.accordionBody}>
              <div className={styles.narrowForm}>
                <TimeRangeForm value={selected} onApply={onChange} calendarTrigger="onButton" />
              </div>
              <TimeRangeList
                title="Recently used absolute ranges"
                options={defaultSelectOptions.slice(0, 4)}
                onSelect={onChange}
                selected={selected}
              />
            </div>
          )}
        </div>
        <TimeRangeList
          title="Relative time range from now"
          options={defaultSelectOptions.slice(0, 50)}
          onSelect={onChange}
          selected={selected}
        />
        <TimeRangeList
          title="Other relative range"
          options={defaultSelectOptions.slice(0, 50)}
          onSelect={onChange}
          selected={selected}
        />
      </CustomScrollbar>
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
          nextLabel={<span className="fa fa-angle-right" />}
          prevLabel={<span className="fa fa-angle-left" />}
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

export default ExtendedTimePicker;
