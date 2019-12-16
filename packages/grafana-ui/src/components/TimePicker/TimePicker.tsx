// Libraries
import React, { PureComponent, createRef } from 'react';
// import { css } from 'emotion';
import classNames from 'classnames';

// Components
import { Tooltip } from '../Tooltip/Tooltip';
import { TimePickerContent } from './Content';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

// Utils & Services
import { isDateTime, DateTime, rangeUtil, TIME_FORMAT } from '@grafana/data';
// import { stylesFactory } from '../../themes/stylesFactory';
import { withTheme } from '../../themes/ThemeContext';

// Types
import { TimeRange, TimeOption, TimeZone, dateMath } from '@grafana/data';
import { Themeable } from '../../types';

// const getStyles = stylesFactory((theme: GrafanaTheme) => {
//   return {
//     timePickerSynced: css`
//       label: timePickerSynced;
//       border-color: ${theme.colors.orangeDark};
//       background-image: none;
//       background-color: transparent;
//       color: ${theme.colors.orangeDark};
//       &:focus,
//       :hover {
//         color: ${theme.colors.orangeDark};
//         background-image: none;
//         background-color: transparent;
//       }
//     `,
//     noRightBorderStyle: css`
//       label: noRightBorderStyle;
//       border-right: 0;
//     `,
//   };
// });

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

export interface Props extends Themeable {
  hideText?: boolean;
  value: TimeRange;
  timeZone?: TimeZone;
  timeSyncButton?: JSX.Element;
  isSynced?: boolean;
  onChange: (timeRange: TimeRange) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onZoom: () => void;
}
export interface State {
  isOpen: boolean;
}

class UnthemedTimePicker extends PureComponent<Props, State> {
  pickerTriggerRef = createRef<HTMLDivElement>();

  state: State = {
    isOpen: false,
  };

  onChange = (timeRange: TimeRange) => {
    const { onChange } = this.props;
    onChange(timeRange);
    this.setState({ isOpen: false });
  };

  onClose = () => {
    this.setState({ isOpen: false });
  };

  render() {
    const {
      value,
      onMoveBackward,
      onMoveForward,
      onZoom,
      timeZone,
      timeSyncButton,
      isSynced,
      // theme,
      hideText,
    } = this.props;

    // const styles = getStyles(theme);
    const { isOpen } = this.state;
    const isUTC = timeZone === 'utc';

    const adjustedTime = (time: DateTime) => (isUTC ? time.utc() : time.local()) || null;
    const adjustedTimeRange = {
      to: dateMath.isMathString(value.raw.to) ? value.raw.to : adjustedTime(value.to),
      from: dateMath.isMathString(value.raw.from) ? value.raw.from : adjustedTime(value.from),
    };
    const rangeString = rangeUtil.describeTimeRange(adjustedTimeRange);

    const label = !hideText ? (
      <>
        <span>{rangeString}</span>
        {isUTC && <span className="time-picker-utc">UTC</span>}
      </>
    ) : (
      ''
    );

    const hasAbsolute = isDateTime(value.raw.from) || isDateTime(value.raw.to);

    return (
      <div className="time-picker" ref={this.pickerTriggerRef}>
        <div className="time-picker-buttons">
          {hasAbsolute && (
            <button className="btn navbar-button navbar-button--tight" onClick={onMoveBackward}>
              <i className="fa fa-chevron-left" />
            </button>
          )}
          <Tooltip content={<TimePickerTooltipContent timeRange={value} />} placement="bottom">
            <button
              className="btn navbar-button navbar-button--zoom"
              onClick={event => {
                event.stopPropagation();
                this.setState({ isOpen: !isOpen });
              }}
            >
              <i className={classNames('fa fa-clock-o fa-fw', isSynced && timeSyncButton && 'icon-brand-gradient')} />
              {label}
            </button>
          </Tooltip>

          {timeSyncButton}

          {hasAbsolute && (
            <button className="btn navbar-button navbar-button--tight" onClick={onMoveForward}>
              <i className="fa fa-chevron-right" />
            </button>
          )}

          <Tooltip content={defaultZoomOutTooltip} placement="bottom">
            <button className="btn navbar-button navbar-button--zoom" onClick={onZoom}>
              <i className="fa fa-search-minus" />
            </button>
          </Tooltip>
        </div>

        {isOpen && (
          <ClickOutsideWrapper onClick={this.onClose}>
            <TimePickerContent
              timeZone={timeZone}
              value={value}
              onChange={this.onChange}
              otherOptions={otherOptions}
              quickOptions={quickOptions}
            />
          </ClickOutsideWrapper>
        )}
      </div>
    );
  }
}

const defaultZoomOutTooltip = () => {
  return (
    <>
      Time range zoom out <br /> CTRL+Z
    </>
  );
};

const TimePickerTooltipContent = ({ timeRange }: { timeRange: TimeRange }) => (
  <>
    {timeRange.from.format(TIME_FORMAT)}
    <div className="text-center">to</div>
    {timeRange.to.format(TIME_FORMAT)}
  </>
);

export const TimePicker = withTheme(UnthemedTimePicker);
