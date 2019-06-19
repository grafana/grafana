import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { SelectOptionItem } from '../Select/Select';
import { Tooltip } from '../Tooltip/Tooltip';
import { ButtonSelect } from '../Select/ButtonSelect';

export const offOption = { label: 'Off', value: '' };
export const liveOption = { label: 'Live', value: 'LIVE' };
export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];
export const isLive = (refreshInterval: string): boolean => refreshInterval === liveOption.value;

export interface Props {
  intervals?: string[];
  onRefresh: () => any;
  onIntervalChanged: (interval: string) => void;
  value?: string;
  tooltip: string;
  hasLiveOption?: boolean;
}

export class RefreshPicker extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  intervalsToOptions = (intervals: string[] | undefined): Array<SelectOptionItem<string>> => {
    const intervalsOrDefault = intervals || defaultIntervals;
    const options = intervalsOrDefault
      .filter(str => str !== '')
      .map(interval => ({ label: interval, value: interval }));

    if (this.props.hasLiveOption) {
      options.unshift(liveOption);
    }

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
    const options = this.intervalsToOptions(intervals);
    const currentValue = value || '';
    const selectedValue = options.find(item => item.value === currentValue) || offOption;

    const cssClasses = classNames({
      'refresh-picker': true,
      'refresh-picker--off': selectedValue.label === offOption.label,
      'refresh-picker--live': selectedValue === liveOption,
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
            className="navbar-button--attached btn--radius-left-0$"
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
