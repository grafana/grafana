import React, { PureComponent } from 'react';
import Select, { SelectOptionItem } from '../Select/Select';

export interface Props {
  value: string | undefined;
  intervals: string[];
  isOpen: boolean;
  onChange: (interval: string) => void;
}

export class RefreshSelect extends PureComponent<Props> {
  pausedItem = { label: 'Paused', value: undefined };

  mapStringToSelectOptionItem = (interval: string | undefined) => {
    return interval ? { label: interval, value: interval } : this.pausedItem;
  };

  intervalsToOptions = (intervals: string[]): SelectOptionItem[] => {
    const options = intervals.map(this.mapStringToSelectOptionItem);
    options.unshift(this.pausedItem);
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
        <Select
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
