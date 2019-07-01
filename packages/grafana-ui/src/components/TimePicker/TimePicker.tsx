// Libraries
import React, { PureComponent, createRef } from 'react';

// Components
import { ButtonSelect } from '../Select/ButtonSelect';
import { Tooltip } from '../Tooltip/Tooltip';
import { TimePickerPopover } from './TimePickerPopover';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

// Utils & Services
import { isDateTime } from '../../utils/moment_wrapper';
import * as rangeUtil from '../../utils/rangeutil';
import { rawToTimeRange } from './time';

// Types
import { TimeRange, TimeOption, TimeZone, TIME_FORMAT } from '../../types/time';
import { SelectOptionItem } from '../Select/Select';

export interface Props {
  value: TimeRange;
  selectOptions: TimeOption[];
  timeZone?: TimeZone;
  onChange: (timeRange: TimeRange) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onZoom: () => void;
}

export const defaultSelectOptions: TimeOption[] = [
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

const defaultZoomOutTooltip = () => {
  return (
    <>
      Time range zoom out <br /> CTRL+Z
    </>
  );
};

export interface State {
  isCustomOpen: boolean;
}
export class TimePicker extends PureComponent<Props, State> {
  pickerTriggerRef = createRef<HTMLDivElement>();

  state: State = {
    isCustomOpen: false,
  };

  mapTimeOptionsToSelectOptionItems = (selectOptions: TimeOption[]) => {
    const options = selectOptions.map(timeOption => {
      return {
        label: timeOption.display,
        value: timeOption,
      };
    });

    options.unshift({
      label: 'Custom time range',
      value: { from: 'custom', to: 'custom', display: 'Custom', section: 1 },
    });

    return options;
  };

  onSelectChanged = (item: SelectOptionItem<TimeOption>) => {
    const { onChange, timeZone } = this.props;

    if (item.value && item.value.from === 'custom') {
      // this is to prevent the ClickOutsideWrapper from directly closing the popover
      setTimeout(() => {
        this.setState({ isCustomOpen: true });
      }, 1);
      return;
    }

    if (item.value) {
      onChange(rawToTimeRange({ from: item.value.from, to: item.value.to }, timeZone));
    }
  };

  onCustomChange = (timeRange: TimeRange) => {
    const { onChange } = this.props;
    onChange(timeRange);
    this.setState({ isCustomOpen: false });
  };

  onCloseCustom = () => {
    this.setState({ isCustomOpen: false });
  };

  render() {
    const { selectOptions: selectTimeOptions, value, onMoveBackward, onMoveForward, onZoom, timeZone } = this.props;
    const { isCustomOpen } = this.state;
    const options = this.mapTimeOptionsToSelectOptionItems(selectTimeOptions);
    const currentOption = options.find(item => isTimeOptionEqualToTimeRange(item.value, value));
    const rangeString = rangeUtil.describeTimeRange(value.raw);

    const label = (
      <>
        {isCustomOpen && <span>Custom time range</span>}
        {!isCustomOpen && <span>{rangeString}</span>}
        {timeZone === 'utc' && <span className="time-picker-utc">UTC</span>}
      </>
    );
    const isAbsolute = isDateTime(value.raw.to);

    return (
      <div className="time-picker" ref={this.pickerTriggerRef}>
        <div className="time-picker-buttons">
          {isAbsolute && (
            <button className="btn navbar-button navbar-button--tight" onClick={onMoveBackward}>
              <i className="fa fa-chevron-left" />
            </button>
          )}
          <ButtonSelect
            className="time-picker-button-select"
            value={currentOption}
            label={label}
            options={options}
            onChange={this.onSelectChanged}
            iconClass={'fa fa-clock-o fa-fw'}
            tooltipContent={<TimePickerTooltipContent timeRange={value} />}
          />
          {isAbsolute && (
            <button className="btn navbar-button navbar-button--tight" onClick={onMoveForward}>
              <i className="fa fa-chevron-right" />
            </button>
          )}

          <Tooltip content={defaultZoomOutTooltip} placement="bottom">
            <button className="btn navbar-button navbar-button--zoom" onClick={onZoom}>
              <i className="fa fa-search-minus" />
            </button>
          </Tooltip>

          {isCustomOpen && (
            <ClickOutsideWrapper onClick={this.onCloseCustom}>
              <TimePickerPopover value={value} timeZone={timeZone} onChange={this.onCustomChange} />
            </ClickOutsideWrapper>
          )}
        </div>
      </div>
    );
  }
}

const TimePickerTooltipContent = ({ timeRange }: { timeRange: TimeRange }) => (
  <>
    {timeRange.from.format(TIME_FORMAT)}
    <div className="text-center">to</div>
    {timeRange.to.format(TIME_FORMAT)}
  </>
);

function isTimeOptionEqualToTimeRange(option: TimeOption, range: TimeRange): boolean {
  return range.raw.from === option.from && range.raw.to === option.to;
}
