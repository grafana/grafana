import React, { PureComponent } from 'react';
import moment from 'moment';
import {
  TimeRange,
  TimeOptions,
  TimeOption,
  SelectOptionItem,
  ClickOutsideWrapper,
  SelectButton,
  HeadlessSelect,
} from '@grafana/ui';

import { mapTimeOptionToTimeRange, mapTimeRangeToRangeString } from './time';
import { Props as TimePickerPopoverProps } from './TimePickerPopover';
import { TimePickerOptionGroup } from './TimePickerOptionGroup';

export interface Props {
  value: TimeRange;
  isTimezoneUtc: boolean;
  popoverOptions: TimeOptions;
  selectOptions: TimeOption[];
  timezone?: string;
  onChange: (timeRange: TimeRange) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onZoom: () => void;
}

export interface State {
  isPopoverOpen: boolean;
  isSelectOpen: boolean;
}

export class TimePicker extends PureComponent<Props, State> {
  state = { isSelectOpen: false, isPopoverOpen: false };

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
        onPopoverOpen: () => this.onPopoverOpen(),
        onPopoverClose: (timeRange: TimeRange) => this.onPopoverClose(timeRange),
        popoverProps,
      },
    ];
  };

  onSelectButtonClicked = () => {
    this.setState({ isSelectOpen: !this.state.isSelectOpen });
  };

  onSelectChanged = (item: SelectOptionItem) => {
    const { isTimezoneUtc, onChange, timezone } = this.props;
    this.setState({ isSelectOpen: !this.state.isSelectOpen });
    onChange(mapTimeOptionToTimeRange(item.value, isTimezoneUtc, timezone));
  };

  onPopoverOpen = () => {
    this.setState({ isPopoverOpen: true });
  };

  onPopoverClose = (timeRange: TimeRange) => {
    const { onChange } = this.props;

    onChange(timeRange);
    this.setState({ isPopoverOpen: false });
  };

  onClickOutside = () => {
    const { isPopoverOpen } = this.state;

    if (!isPopoverOpen) {
      this.setState({ isSelectOpen: false });
    }
  };

  render() {
    const { selectOptions: selectTimeOptions, value, onMoveBackward, onMoveForward, onZoom } = this.props;
    const { isSelectOpen } = this.state;
    const options = this.mapTimeOptionsToSelectOptionItems(selectTimeOptions);
    const rangeString = mapTimeRangeToRangeString(value);
    const isAbsolute = moment.isMoment(value.raw.to);

    return (
      <ClickOutsideWrapper onClick={this.onClickOutside}>
        <div className="time-picker">
          <div className="time-picker-buttons">
            {isAbsolute && (
              <button className="btn navbar-button navbar-button--tight" onClick={onMoveBackward}>
                <i className="fa fa-chevron-left" />
              </button>
            )}
            <SelectButton
              onClick={this.onSelectButtonClicked}
              textWhenUndefined={'NaN'}
              value={rangeString}
              iconClass={'fa fa-clock-o'}
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
          <div className="time-picker-select">
            <HeadlessSelect
              components={{ Group: TimePickerOptionGroup }}
              isOpen={isSelectOpen}
              onChange={this.onSelectChanged}
              options={options}
            />
          </div>
        </div>
      </ClickOutsideWrapper>
    );
  }
}
