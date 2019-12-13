import React, { useState } from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme, TimeOption, TimeRange, DateTime, TIME_FORMAT, isDateTime } from '@grafana/data';
import { css } from 'emotion';
import TimeRangeTitle from './TimeRangeTitle';
import TimeRangeForm from './TimeRangeForm';
import { CustomScrollbar } from '../../CustomScrollbar/CustomScrollbar';
import TimeRangeList from './TimeRangeList';
import {} from '../time';

const quickOptions: TimeOption[] = [
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
];

const otherOptions: TimeOption[] = [
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
  };
});

interface Props {
  selected: TimeRange;
  onChange: (timeRange: TimeRange) => void;
}

const ExtendedTimePicker: React.FC<Props> = ({ selected, onChange }) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);
  const [collapsed, setCollapsed] = useState(false);
  const [recent, setRecent] = useState<TimeOption[]>([]);

  const onSelect = (range: TimeRange) => {
    const start = recent.length - 3;
    const nextRecent = recent.slice(start >= 0 ? start : 0);

    nextRecent.push({
      from: valueAsString(range.from),
      to: valueAsString(range.to),
      display: `${valueAsString(range.from)} to ${valueAsString(range.to)}`,
      section: 3,
    });

    setRecent(nextRecent);
    //onChange(range);
  };

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
          <TimeRangeForm value={selected} onApply={onSelect} calendarTrigger="onFocus" />
        </div>
        <div className={styles.recentRanges}>
          <TimeRangeList
            title="Recently used absolute ranges"
            options={recent}
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
                options={recent}
                onSelect={onChange}
                selected={selected}
              />
            </div>
          )}
        </div>
        <TimeRangeList
          title="Relative time range from now"
          options={quickOptions}
          onSelect={onChange}
          selected={selected}
        />
        <TimeRangeList title="Other relative range" options={otherOptions} onSelect={onChange} selected={selected} />
      </CustomScrollbar>
    </div>
  );
};

export default ExtendedTimePicker;

function valueAsString(value: DateTime | string): string {
  if (isDateTime(value)) {
    return value.format(TIME_FORMAT);
  }
  return value;
}
