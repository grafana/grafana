import React, { PureComponent } from 'react';
import { SelectOptionItem } from '../Select/Select';
import { HeadlessSelect } from '../Select/HeadlessSelect';

export const EMPTY_ITEM_TEXT = 'Off';

export interface Props {
  value: string | undefined;
  intervals: string[];
  isOpen: boolean;
  onChange: (interval: string) => void;
}

export class RefreshSelect extends PureComponent<Props> {
  emptyItem = { label: EMPTY_ITEM_TEXT, value: undefined };

  mapStringToSelectOptionItem = (interval: string | undefined) => {
    return interval ? { label: interval, value: interval } : this.emptyItem;
  };

  intervalsToOptions = (intervals: string[]): SelectOptionItem[] => {
    const options = intervals.map(this.mapStringToSelectOptionItem);
    options.unshift(this.emptyItem);
    return options;
  };

  onChange = (item: SelectOptionItem) => {
    this.props.onChange(item.value);
  };

  render() {
    const { intervals, isOpen, value } = this.props;
    const options = this.intervalsToOptions(intervals);
    const selectedValue = this.mapStringToSelectOptionItem(value);

    return (
      <div className="refresh-select">
        <HeadlessSelect
          autoFocus
          backspaceRemovesValue={false}
          isClearable={false}
          onChange={this.onChange}
          options={options}
          value={selectedValue}
          placeholder={' '}
          isSearchable={false}
          menuIsOpen={isOpen}
          maxMenuHeight={380}
        />
      </div>
    );
  }
}
