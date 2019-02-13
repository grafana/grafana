import React, { PureComponent } from 'react';
import moment from 'moment';
import { TimeRange, TimeOptions, TimeOption, SelectOptionItem, ButtonSelect } from '@grafana/ui';

import { mapTimeOptionToTimeRange, mapTimeRangeToRangeString } from './time';
import { Props as TimePickerPopoverProps, TimePickerPopover } from './TimePickerPopover';
import { TimePickerOptionGroup } from './TimePickerOptionGroup';
import ReactDOM from 'react-dom';

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

export class TimePicker extends PureComponent<Props> {
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

  onSelectChanged = (item: SelectOptionItem) => {
    const { isTimezoneUtc, onChange, timezone } = this.props;
    onChange(mapTimeOptionToTimeRange(item.value, isTimezoneUtc, timezone));
  };

  onPopoverClose = (timeRange: TimeRange) => {
    const { onChange } = this.props;
    onChange(timeRange);
    // Here we should also close the Select but no sure how to solve this without introducing state in this component
  };

  // Makes sure that we don't close the popover when user clicks inside the popover
  onOutsideClick = (event: any): boolean => {
    const popoverElement = document.getElementsByClassName(TimePickerPopover.popoverClassName)[0];
    const popoverNode = ReactDOM.findDOMNode(popoverElement) as Element;

    if (popoverNode && popoverNode.contains(event.target)) {
      return false;
    }

    return true;
  };

  render() {
    const { selectOptions: selectTimeOptions, value, onMoveBackward, onMoveForward, onZoom } = this.props;
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
            onOutsideClick={this.onOutsideClick}
            iconClass={'fa fa-clock-o fa-fw'}
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
