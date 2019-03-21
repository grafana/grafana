import React, { PureComponent } from 'react';
import { SelectOptionItem, ButtonSelect } from '@grafana/ui';

import { RefreshButton } from './RefreshButton';

export const EMPTY_ITEM_TEXT = 'Off';

export interface Props {
  initialValue: string | undefined;
  intervals: string[];
  onRefreshClicked: () => void;
  onIntervalChanged: (item: SelectOptionItem) => void;
  value: SelectOptionItem;
}

export class RefreshPicker extends PureComponent<Props> {
  emptyItem = { label: EMPTY_ITEM_TEXT, value: undefined };
  constructor(props: Props) {
    super(props);
  }

  mapStringToSelectOptionItem = (interval: string | undefined) => {
    return interval ? { label: interval, value: interval } : this.emptyItem;
  };

  intervalsToOptions = (intervals: string[]): SelectOptionItem[] => {
    const options = intervals.map(this.mapStringToSelectOptionItem);
    options.unshift(this.emptyItem);

    return options;
  };

  onSelectChanged = (item: SelectOptionItem) => {
    this.props.onIntervalChanged(item);
  };

  onClickOutside = () => this.setState({ isSelectOpen: false });

  render() {
    const { onRefreshClicked, intervals, initialValue } = this.props;

    const options = this.intervalsToOptions(intervals);
    const selectedValue = this.props.value || this.mapStringToSelectOptionItem(initialValue) || this.emptyItem;

    return (
      <div className="refresh-picker">
        <div className="refresh-picker-buttons">
          <RefreshButton onClick={onRefreshClicked} />
          <ButtonSelect
            className="refresh-picker-button-select"
            value={selectedValue}
            label={selectedValue.label}
            options={options}
            onChange={this.onSelectChanged}
            maxMenuHeight={380}
          />
        </div>
      </div>
    );
  }
}
