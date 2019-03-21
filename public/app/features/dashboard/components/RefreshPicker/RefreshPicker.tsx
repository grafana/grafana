import React, { PureComponent } from 'react';
import { SelectOptionItem, ButtonSelect } from '@grafana/ui';
import { stringToMs } from '@grafana/ui/src/utils/string';
import { RefreshButton } from './RefreshButton';

export const EMPTY_ITEM_TEXT = 'Off';

export interface Props {
  initialValue: string;
  intervals: string[];
  onRefresh: () => void;
  onIntervalChanged: (item: SelectOptionItem) => void;
  value?: SelectOptionItem;
}

export class RefreshPicker extends PureComponent<Props> {
  emptyItem = { label: EMPTY_ITEM_TEXT, value: undefined };
  refreshIntervalId: number | undefined = undefined;

  constructor(props: Props) {
    super(props);
  }

  mapStringToSelectOptionItem = (interval: string): SelectOptionItem => {
    console.log('interval', interval);
    return interval ? { label: interval, value: stringToMs(interval) } : this.emptyItem;
  };

  intervalsToOptions = (intervals: string[]): SelectOptionItem[] => {
    const options = intervals.map(this.mapStringToSelectOptionItem);
    options.unshift(this.emptyItem);
    return options;
  };

  onSelectChanged = (item: SelectOptionItem) => {
    const { onRefresh } = this.props;
    this.props.onIntervalChanged(item);
    window.clearInterval(this.refreshIntervalId);

    if (onRefresh && item.value) {
      this.refreshIntervalId = window.setInterval(onRefresh, item.value);
    }
  };

  componentWillUnmount() {
    if (this.refreshIntervalId) {
      window.clearInterval(this.refreshIntervalId);
    }
  }

  onClickOutside = () => this.setState({ isSelectOpen: false });

  render() {
    const { onRefresh, intervals, initialValue } = this.props;
    const options = this.intervalsToOptions(intervals);
    const selectedValue =
      this.props.value || (initialValue ? this.mapStringToSelectOptionItem(initialValue) : this.emptyItem);
    // const selectedValue = this.props.value || this.emptyItem;

    return (
      <div className="refresh-picker">
        <div className="refresh-picker-buttons">
          <RefreshButton onClick={onRefresh} />
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
