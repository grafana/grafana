import React, { PureComponent } from 'react';
import { SelectOptionItem, ButtonSelect } from '@grafana/ui';
import { stringToMs } from '@grafana/ui/src/utils/string';
import { RefreshButton } from './RefreshButton';

export const EMPTY_ITEM_TEXT = 'Off';
export const defaultItem = { label: EMPTY_ITEM_TEXT, value: 0 };
export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];

export interface Props {
  initialValue: string;
  intervals?: string[];
  onRefresh: () => void;
  onIntervalChanged: (item: SelectOptionItem) => void;
  value?: SelectOptionItem;
}

export class RefreshPicker extends PureComponent<Props> {
  emptyItem = defaultItem;

  constructor(props: Props) {
    super(props);
  }

  mapStringToSelectOptionItem = (interval: string): SelectOptionItem => {
    return interval ? { label: interval, value: stringToMs(interval) } : this.emptyItem;
  };

  intervalsToOptions = (intervals: string[] = defaultIntervals): SelectOptionItem[] => {
    const options = intervals.map(this.mapStringToSelectOptionItem);
    options.unshift(this.emptyItem);
    return options;
  };

  onChangeSelect = (item: SelectOptionItem) => {
    const { onIntervalChanged } = this.props;
    if (onIntervalChanged) {
      onIntervalChanged(item);
    }
  };

  render() {
    const { onRefresh, intervals, initialValue } = this.props;
    const options = this.intervalsToOptions(intervals);
    const selectedValue =
      this.props.value || (initialValue ? this.mapStringToSelectOptionItem(initialValue) : this.emptyItem);

    return (
      <div className="refresh-picker">
        <div className="refresh-picker-buttons">
          <RefreshButton onClick={onRefresh} />
          <ButtonSelect
            className="refresh-picker-button-select"
            value={selectedValue}
            label={selectedValue.label}
            options={options}
            onChange={this.onChangeSelect}
            maxMenuHeight={380}
          />
        </div>
      </div>
    );
  }
}
