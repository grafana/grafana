import React, { PureComponent } from 'react';
import { SelectOptionItem, ButtonSelect, Tooltip } from '@grafana/ui';
import { stringToMs } from '@grafana/ui/src/utils/string';
import { RefreshButton } from './RefreshButton';

export const EMPTY_ITEM_TEXT = 'Off';
export const defaultItem = { label: EMPTY_ITEM_TEXT, value: 0 };
export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];

export interface Props {
  initialValue: string;
  intervals?: string[];
  onRefresh: () => any; // Promise<any> | ThunkAction<Promise<any>>
  onIntervalChanged: (item: SelectOptionItem) => void;
  value?: SelectOptionItem;
  tooltip: string;
}

export class RefreshPicker extends PureComponent<Props> {
  static defaultProps = {
    intervals: defaultIntervals,
  };

  emptyItem = defaultItem;

  constructor(props: Props) {
    super(props);
  }

  hasNoIntervals = () => {
    const { intervals } = this.props;
    // Current implementaion returns an array with length of 1 consisting of
    // an empty string when auto-refresh is empty in dashboard settings
    if (!intervals || intervals.length < 1 || (intervals.length === 1 && intervals[0] === '')) {
      return true;
    }
    return false;
  };

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
    const { onRefresh, intervals, initialValue, tooltip } = this.props;
    const options = this.intervalsToOptions(this.hasNoIntervals() ? defaultIntervals : intervals);
    const selectedValue =
      this.props.value || (initialValue ? this.mapStringToSelectOptionItem(initialValue) : this.emptyItem);

    return (
      <div className="refresh-picker">
        <div className="refresh-picker-buttons">
          <Tooltip placement="top" content={tooltip}>
            <span>
              <RefreshButton onClick={onRefresh} />
            </span>
          </Tooltip>
          <ButtonSelect
            className="refresh-picker-button-select btn--radius-left-0 nav navbar-button--attached"
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
