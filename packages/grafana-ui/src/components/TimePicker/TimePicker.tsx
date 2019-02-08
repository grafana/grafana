import React, { PureComponent, createRef } from 'react';

import { TimePickerOptionGroup } from './TimePickerOptionGroup';
import { TimePickerPopOver } from './TimePickerPopOver';
import Popper from '../Tooltip/Popper';
import { TimeRange } from '../../types/time';
import { SelectOptionItem } from '../Select/Select';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { SelectButton } from '../Select/SelectButton';
import { HeadlessSelect } from '../Select/HeadlessSelect';

export interface TimeOption {
  from: string;
  to: string;
  display: string;
  section: number;
  active: boolean;
}

export interface TimeOptions {
  [key: string]: TimeOption[];
}

export interface Props {
  value: TimeRange;
  displayValue: string;
  popOverTimeOptions: TimeOptions;
  selectTimeOptions: TimeOption[];
  onChange: (timeOption: TimeOption) => void;
}

export interface State {
  isPopOverOpen: boolean;
  isSelectOpen: boolean;
}

export class TimePicker extends PureComponent<Props, State> {
  pickerTriggerRef = createRef<HTMLDivElement>();

  constructor(props: Props) {
    super(props);
    this.state = { isSelectOpen: false, isPopOverOpen: false };
  }

  mapTimeOptionsToSelectOptionItems = (selectTimeOptions: TimeOption[]) => {
    const options = selectTimeOptions.map(timeOption => {
      return { label: timeOption.display, value: timeOption };
    });

    return [{ label: 'Custom', expanded: true, options, onCustomClick: (ref: any) => this.onCustomClicked() }];
  };

  toggleIsSelectOpen = () => this.setState({ isSelectOpen: !this.state.isSelectOpen });

  onSelectButtonClicked = () => {
    this.toggleIsSelectOpen();
  };

  onSelectChanged = (item: SelectOptionItem) => {
    this.toggleIsSelectOpen();
    this.props.onChange(item.value);
  };

  onCustomClicked = () => {
    this.setState({ isSelectOpen: false, isPopOverOpen: true });
  };

  onPopOverLeave = () => {
    this.setState({ isSelectOpen: true, isPopOverOpen: false });
  };

  onClickOutside = () => this.setState({ isSelectOpen: false });

  render() {
    const { displayValue, selectTimeOptions } = this.props;
    const { isSelectOpen, isPopOverOpen } = this.state;
    const options = this.mapTimeOptionsToSelectOptionItems(selectTimeOptions);
    const popover = TimePickerPopOver;
    const popoverElement = React.createElement(popover, {
      ...this.props,
      onClick: (timeOption: TimeOption) => ({}),
    });
    return (
      <ClickOutsideWrapper onClick={this.onClickOutside}>
        <div className={'time-picker'}>
          <div className={'time-picker-buttons'}>
            <SelectButton onClick={this.onSelectButtonClicked} textWhenUndefined={'NaN'} value={displayValue} />
          </div>
          <div className={'time-picker-picker'} ref={this.pickerTriggerRef} />
          <div className={'time-picker-select'}>
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
                onMouseLeave={this.onPopOverLeave}
                placement={'auto'}
              />
            )}
          </div>
        </div>
      </ClickOutsideWrapper>
    );
  }
}
