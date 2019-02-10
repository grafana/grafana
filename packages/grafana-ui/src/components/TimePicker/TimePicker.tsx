import React, { PureComponent, createRef } from 'react';

import { TimePickerOptionGroup } from './TimePickerOptionGroup';
import { TimePickerPopOver } from './TimePickerPopOver';
import Popper from '../Tooltip/Popper';
import { TimeRange, TimeOptions, TimeOption } from '../../types/time';
import { SelectOptionItem } from '../Select/Select';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { SelectButton } from '../Select/SelectButton';
import { HeadlessSelect } from '../Select/HeadlessSelect';
import { mapTimeOptionToTimeRange, mapTimeRangeToRangeString } from '../../utils/time';

export interface Props {
  value: TimeRange;
  isTimezoneUtc: boolean;
  popOverTimeOptions: TimeOptions;
  selectTimeOptions: TimeOption[];
  timezone?: string;
  onChange: (timeRange: TimeRange) => void;
}

export interface State {
  isPopOverOpen: boolean;
  isSelectOpen: boolean;
}

export class TimePicker extends PureComponent<Props, State> {
  pickerTriggerRef = createRef<HTMLDivElement>();
  state = { isSelectOpen: false, isPopOverOpen: false };

  mapTimeOptionsToSelectOptionItems = (selectTimeOptions: TimeOption[]) => {
    const options = selectTimeOptions.map(timeOption => {
      return { label: timeOption.display, value: timeOption };
    });

    return [{ label: 'Custom', expanded: true, options, onCustomClick: (ref: any) => this.onCustomClicked() }];
  };

  onSelectButtonClicked = () => {
    this.setState({ isSelectOpen: !this.state.isSelectOpen, isPopOverOpen: false });
  };

  onSelectChanged = (item: SelectOptionItem) => {
    const { isTimezoneUtc, onChange, timezone } = this.props;
    this.setState({ isSelectOpen: !this.state.isSelectOpen, isPopOverOpen: false });
    onChange(mapTimeOptionToTimeRange(item.value, isTimezoneUtc, timezone));
  };

  onCustomClicked = () => {
    this.setState({ isPopOverOpen: true });
  };

  onClickOutside = () => {
    if (!this.state.isPopOverOpen) {
      this.setState({ isSelectOpen: false });
    }
  };

  render() {
    const { selectTimeOptions, onChange, value } = this.props;
    const { isSelectOpen, isPopOverOpen } = this.state;
    const options = this.mapTimeOptionsToSelectOptionItems(selectTimeOptions);
    const popover = TimePickerPopOver;
    const popoverElement = React.createElement(popover, {
      ...this.props,
      onChange: (timeRange: TimeRange) => {
        onChange(timeRange);
        this.setState({ isPopOverOpen: false });
      },
    });
    const rangeString = mapTimeRangeToRangeString(value);

    return (
      <ClickOutsideWrapper onClick={this.onClickOutside}>
        <div className={'time-picker'}>
          <div className={'time-picker-buttons'}>
            <SelectButton onClick={this.onSelectButtonClicked} textWhenUndefined={'NaN'} value={rangeString} />
          </div>
          <div className={'time-picker-select'} ref={this.pickerTriggerRef}>
            <HeadlessSelect
              components={{ Group: TimePickerOptionGroup }}
              menuIsOpen={isSelectOpen}
              onChange={this.onSelectChanged}
              options={options}
            />
          </div>
          <div>
            {this.pickerTriggerRef.current && (
              <Popper
                show={isPopOverOpen}
                content={popoverElement}
                referenceElement={this.pickerTriggerRef.current}
                placement={'left-start'}
              />
            )}
          </div>
        </div>
      </ClickOutsideWrapper>
    );
  }
}
