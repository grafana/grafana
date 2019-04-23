import React, { PureComponent } from 'react';
import classNames from 'classnames';

import { SelectOptionItem, ButtonSelect, Tooltip } from '@grafana/ui';

export const offOption = { label: 'Off', value: '' };
export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];

export interface Props {
  intervals?: string[];
  onRefresh: () => any;
  onIntervalChanged: (interval: string) => void;
  value?: string;
  tooltip: string;
}

export class RefreshPicker extends PureComponent<Props> {
  static defaultProps = {
    intervals: defaultIntervals,
  };

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

  intervalsToOptions = (intervals: string[] = defaultIntervals): Array<SelectOptionItem<string>> => {
    const options = intervals.map(interval => ({ label: interval, value: interval }));
    options.unshift(offOption);
    return options;
  };

  onChangeSelect = (item: SelectOptionItem<string>) => {
    const { onIntervalChanged } = this.props;
    if (onIntervalChanged) {
      // @ts-ignore
      onIntervalChanged(item.value);
    }
  };

  render() {
    const { onRefresh, intervals, tooltip, value } = this.props;
    const options = this.intervalsToOptions(this.hasNoIntervals() ? defaultIntervals : intervals);
    const currentValue = value || '';
    const selectedValue = options.find(item => item.value === currentValue) || offOption;

    const cssClasses = classNames({
      'refresh-picker': true,
      'refresh-picker--refreshing': selectedValue.label !== offOption.label,
    });

    return (
      <div className={cssClasses}>
        <div className="refresh-picker-buttons">
          <Tooltip placement="top" content={tooltip}>
            <button className="btn btn--radius-right-0 navbar-button navbar-button--refresh" onClick={onRefresh}>
              <i className="fa fa-refresh" />
            </button>
          </Tooltip>
          <ButtonSelect
            className="navbar-button--attached btn--radius-left-0"
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
