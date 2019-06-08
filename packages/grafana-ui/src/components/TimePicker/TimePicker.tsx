import React, { PureComponent, createRef } from 'react';
import { ButtonSelect } from '../Select/ButtonSelect';
import { mapTimeOptionToTimeRange, mapTimeRangeToRangeString } from './time';
import { PopperContent } from '../Tooltip/PopperController';
import { Timezone } from '../../utils/datemath';
import { TimeRange, TimeOption } from '../../types/time';
import { SelectOptionItem } from '../Select/Select';
import { getRawTimeRangeToShow } from '../../utils/date';
import { Tooltip } from '../Tooltip/Tooltip';
import { isDateTime } from '../../utils/moment_wrapper';
import { TimePickerPopover } from './TimePickerPopover';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

export interface Props {
  value: TimeRange;
  isTimezoneUtc: boolean;
  selectOptions: TimeOption[];
  timezone?: Timezone;
  onChange: (timeRange: TimeRange) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onZoom: () => void;
  tooltipContent?: PopperContent<any>;
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
  isMenuOpen: boolean;
  isCustomOpen: boolean;
}

export class TimePicker extends PureComponent<Props, State> {
  pickerTriggerRef = createRef<HTMLDivElement>();

  state: State = {
    isMenuOpen: false,
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
    const { isTimezoneUtc, onChange, timezone } = this.props;

    if (item.value && item.value.from === 'custom') {
      this.setState({ isCustomOpen: true });
      return;
    }

    // @ts-ignore
    onChange(mapTimeOptionToTimeRange(item.value, isTimezoneUtc, timezone));
  };

  onChangeMenuOpenState = (isOpen: boolean) => {
    this.setState({ isMenuOpen: isOpen });
  };

  onOpenMenu = () => this.onChangeMenuOpenState(true);
  onCloseMenu = () => this.onChangeMenuOpenState(false);

  onCustomChange = (timeRange: TimeRange) => {
    const { onChange } = this.props;
    onChange(timeRange);
    this.setState({ isCustomOpen: false });
  };

  onCloseCustom = () => {
    // this.setState({ isCustomOpen: false });
  };

  render() {
    const {
      selectOptions: selectTimeOptions,
      value,
      onMoveBackward,
      onMoveForward,
      onZoom,
      tooltipContent,
      isTimezoneUtc,
      timezone,
    } = this.props;
    const { isCustomOpen } = this.state;

    const options = this.mapTimeOptionsToSelectOptionItems(selectTimeOptions);
    const currentOption = options.find(item => isTimeOptionEqualToTimeRange(item.value, value));
    const label = (
      <>
        {mapTimeRangeToRangeString(getRawTimeRangeToShow(isTimezoneUtc, value.raw))}
        {isTimezoneUtc && <span className="time-picker-utc">UTC</span>}
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
            tooltipContent={tooltipContent}
            isMenuOpen={this.state.isMenuOpen}
            onOpenMenu={this.onOpenMenu}
            onCloseMenu={this.onCloseMenu}
            tabSelectsValue={false}
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
              <TimePickerPopover
                value={value}
                isTimezoneUtc={isTimezoneUtc}
                timezone={timezone}
                onChange={this.onCustomChange}
              />
            </ClickOutsideWrapper>
          )}
        </div>
      </div>
    );
  }
}

function isTimeOptionEqualToTimeRange(option: TimeOption, range: TimeRange): boolean {
  return range.raw.from === option.from && range.raw.to === option.to;
}
