import React, { PureComponent } from 'react';
import moment from 'moment';
import { TimeRange, TimeOptions, TimeOption, SelectOptionItem } from '@grafana/ui';
import { ButtonSelect } from '@grafana/ui/src/components/Select/ButtonSelect';
import { mapTimeOptionToTimeRange, mapTimeRangeToRangeString } from './time';
import { Props as TimePickerPopoverProps } from './TimePickerPopover';
import { TimePickerOptionGroup } from './TimePickerOptionGroup';
import { PopperContent } from '@grafana/ui/src/components/Tooltip/PopperController';
import { Timezone } from '../../../../../public/app/core/utils/datemath';

export interface Props {
  value: TimeRange;
  isTimezoneUtc: boolean;
  popoverOptions: TimeOptions;
  selectOptions: TimeOption[];
  timezone?: Timezone;
  onChange: (timeRange: TimeRange) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onZoom: () => void;
  tooltipContent?: PopperContent<any>;
}

const defaultSelectOptions = [
  { from: 'now-5m', to: 'now', display: 'Last 5 minutes', section: 3, active: false },
  { from: 'now-15m', to: 'now', display: 'Last 15 minutes', section: 3, active: false },
  { from: 'now-30m', to: 'now', display: 'Last 30 minutes', section: 3, active: false },
  { from: 'now-1h', to: 'now', display: 'Last 1 hour', section: 3, active: false },
  { from: 'now-3h', to: 'now', display: 'Last 3 hours', section: 3, active: false },
  { from: 'now-6h', to: 'now', display: 'Last 6 hours', section: 3, active: false },
  { from: 'now-12h', to: 'now', display: 'Last 12 hours', section: 3, active: false },
  { from: 'now-24h', to: 'now', display: 'Last 24 hours', section: 3, active: false },
];

const defaultPopoverOptions = {
  '0': [
    {
      from: 'now-2d',
      to: 'now',
      display: 'Last 2 days',
      section: 0,
      active: false,
    },
    {
      from: 'now-7d',
      to: 'now',
      display: 'Last 7 days',
      section: 0,
      active: false,
    },
    {
      from: 'now-30d',
      to: 'now',
      display: 'Last 30 days',
      section: 0,
      active: false,
    },
    {
      from: 'now-90d',
      to: 'now',
      display: 'Last 90 days',
      section: 0,
      active: false,
    },
    {
      from: 'now-6M',
      to: 'now',
      display: 'Last 6 months',
      section: 0,
      active: false,
    },
    {
      from: 'now-1y',
      to: 'now',
      display: 'Last 1 year',
      section: 0,
      active: false,
    },
    {
      from: 'now-2y',
      to: 'now',
      display: 'Last 2 years',
      section: 0,
      active: false,
    },
    {
      from: 'now-5y',
      to: 'now',
      display: 'Last 5 years',
      section: 0,
      active: false,
    },
  ],
  '1': [
    {
      from: 'now-1d/d',
      to: 'now-1d/d',
      display: 'Yesterday',
      section: 1,
      active: false,
    },
    {
      from: 'now-2d/d',
      to: 'now-2d/d',
      display: 'Day before yesterday',
      section: 1,
      active: false,
    },
    {
      from: 'now-7d/d',
      to: 'now-7d/d',
      display: 'This day last week',
      section: 1,
      active: false,
    },
    {
      from: 'now-1w/w',
      to: 'now-1w/w',
      display: 'Previous week',
      section: 1,
      active: false,
    },
    {
      from: 'now-1M/M',
      to: 'now-1M/M',
      display: 'Previous month',
      section: 1,
      active: false,
    },
    {
      from: 'now-1y/y',
      to: 'now-1y/y',
      display: 'Previous year',
      section: 1,
      active: false,
    },
  ],
  '2': [
    {
      from: 'now/d',
      to: 'now/d',
      display: 'Today',
      section: 2,
      active: true,
    },
    {
      from: 'now/d',
      to: 'now',
      display: 'Today so far',
      section: 2,
      active: false,
    },
    {
      from: 'now/w',
      to: 'now/w',
      display: 'This week',
      section: 2,
      active: false,
    },
    {
      from: 'now/w',
      to: 'now',
      display: 'This week so far',
      section: 2,
      active: false,
    },
    {
      from: 'now/M',
      to: 'now/M',
      display: 'This month',
      section: 2,
      active: false,
    },
    {
      from: 'now/M',
      to: 'now',
      display: 'This month so far',
      section: 2,
      active: false,
    },
    {
      from: 'now/y',
      to: 'now/y',
      display: 'This year',
      section: 2,
      active: false,
    },
    {
      from: 'now/y',
      to: 'now',
      display: 'This year so far',
      section: 2,
      active: false,
    },
  ],
};

export interface State {
  isMenuOpen: boolean;
}

export class TimePicker extends PureComponent<Props, State> {
  static defaultSelectOptions = defaultSelectOptions;
  static defaultPopoverOptions = defaultPopoverOptions;
  state: State = {
    isMenuOpen: false,
  };

  mapTimeOptionsToSelectOptionItems = (selectOptions: TimeOption[]) => {
    const { value, popoverOptions, isTimezoneUtc, timezone } = this.props;
    const options = selectOptions.map(timeOption => {
      return { label: timeOption.display, value: timeOption };
    });

    const popoverProps: TimePickerPopoverProps = {
      value,
      options: popoverOptions,
      isTimezoneUtc,
      timezone,
    };

    return [
      {
        label: 'Custom',
        expanded: true,
        options,
        onPopoverOpen: () => undefined,
        onPopoverClose: (timeRange: TimeRange) => this.onPopoverClose(timeRange),
        popoverProps,
      },
    ];
  };

  onSelectChanged = (item: SelectOptionItem<TimeOption>) => {
    const { isTimezoneUtc, onChange, timezone } = this.props;

    // @ts-ignore
    onChange(mapTimeOptionToTimeRange(item.value, isTimezoneUtc, timezone));
  };

  onChangeMenuOpenState = (isOpen: boolean) => {
    this.setState({
      isMenuOpen: isOpen,
    });
  };
  onOpenMenu = () => this.onChangeMenuOpenState(true);
  onCloseMenu = () => this.onChangeMenuOpenState(false);

  onPopoverClose = (timeRange: TimeRange) => {
    const { onChange } = this.props;
    onChange(timeRange);
    // Here we should also close the Select but no sure how to solve this without introducing state in this component
    // Edit: State introduced
    this.onCloseMenu();
  };

  render() {
    const {
      selectOptions: selectTimeOptions,
      value,
      onMoveBackward,
      onMoveForward,
      onZoom,
      tooltipContent,
    } = this.props;
    const options = this.mapTimeOptionsToSelectOptionItems(selectTimeOptions);
    const rangeString = mapTimeRangeToRangeString(value);
    const isAbsolute = moment.isMoment(value.raw.to);

    return (
      <div className="time-picker">
        <div className="time-picker-buttons">
          {isAbsolute && (
            <button className="btn navbar-button navbar-button--tight" onClick={onMoveBackward}>
              <i className="fa fa-chevron-left" />
            </button>
          )}
          <ButtonSelect
            className="time-picker-button-select"
            value={value}
            label={rangeString}
            options={options}
            onChange={this.onSelectChanged}
            components={{ Group: TimePickerOptionGroup }}
            iconClass={'fa fa-clock-o fa-fw'}
            tooltipContent={tooltipContent}
            isMenuOpen={this.state.isMenuOpen}
            onOpenMenu={this.onOpenMenu}
            onCloseMenu={this.onCloseMenu}
          />
          {isAbsolute && (
            <button className="btn navbar-button navbar-button--tight" onClick={onMoveForward}>
              <i className="fa fa-chevron-right" />
            </button>
          )}
          <button className="btn navbar-button navbar-button--zoom" onClick={onZoom}>
            <i className="fa fa-search-minus" />
          </button>
        </div>
      </div>
    );
  }
}
