import React, { PureComponent } from 'react';
import { Moment } from 'moment';
import { SelectOptionItem, ClickOutsideWrapper, SelectButton, HeadlessSelect } from '@grafana/ui';

import { TimePickerOptionGroup } from './TimePickerOptionGroup';

export interface TimeRaw {
  from: string | Moment;
  to: string | Moment;
}

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
  value: TimeRaw;
  displayValue: string;
  popOverTimeOptions?: TimeOptions;
  selectTimeOptions: TimeOption[];
  onChange: (timeOption: TimeOption) => void;
}

export interface State {
  isSelectOpen: boolean;
}

export class TimePicker extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { isSelectOpen: false };
  }

  mapTimeOptionsToSelectOptionItems = (selectTimeOptions: TimeOption[]) => {
    const options = selectTimeOptions.map(timeOption => {
      return { label: timeOption.display, value: timeOption };
    });

    return [{ label: 'Custom', expanded: true, options, onCustomClick: () => this.onCustomClicked() }];
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
    console.log('Custom clicked');
  };

  onClickOutside = () => this.setState({ isSelectOpen: false });

  render() {
    const { displayValue, selectTimeOptions } = this.props;
    const { isSelectOpen } = this.state;
    const options = this.mapTimeOptionsToSelectOptionItems(selectTimeOptions);

    return (
      <ClickOutsideWrapper onClick={this.onClickOutside}>
        <div className={'time-picker'}>
          <div className={'time-picker-buttons'}>
            <SelectButton onClick={this.onSelectButtonClicked} textWhenUndefined={'NaN'} value={displayValue} />
          </div>
          <div className={'time-picker-select'}>
            <HeadlessSelect
              components={{ Group: TimePickerOptionGroup }}
              menuIsOpen={isSelectOpen}
              onChange={this.onSelectChanged}
              options={options}
            />
          </div>
        </div>
      </ClickOutsideWrapper>
    );
  }
}
