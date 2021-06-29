import React, { PureComponent } from 'react';
import { InlineField, Input, Switch, TimeZonePicker, Tooltip } from '@grafana/ui';
import { rangeUtil, TimeZone } from '@grafana/data';
import isEmpty from 'lodash/isEmpty';
import { selectors } from '@grafana/e2e-selectors';
import { AutoRefreshIntervals } from './AutoRefreshIntervals';

interface Props {
  onTimeZoneChange: (timeZone: TimeZone) => void;
  onRefreshIntervalChange: (interval: string[]) => void;
  onNowDelayChange: (nowDelay: string) => void;
  onMaxTimeRangeChange: (maxTimeRange: string) => void;
  onOldestFromChange: (oldestFrom: string) => void;
  onHideTimePickerChange: (hide: boolean) => void;
  renderCount: number; // hack to make sure Angular changes are propagated properly, please remove when DashboardSettings are migrated to React
  refreshIntervals: string[];
  timePickerHidden: boolean;
  nowDelay: string;
  maxTimeRange: string;
  oldestFrom: string;
  timezone: TimeZone;
}

interface State {
  isNowDelayValid: boolean;
  isMaxTimeRangeValid: boolean;
  isOldestFromValid: boolean;
}

export class TimePickerSettings extends PureComponent<Props, State> {
  state: State = { isNowDelayValid: true, isMaxTimeRangeValid: true, isOldestFromValid: true };

  onNowDelayChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;

    if (isEmpty(value)) {
      this.setState({ isNowDelayValid: true });
      return this.props.onNowDelayChange(value);
    }

    if (rangeUtil.isValidTimeSpan(value)) {
      this.setState({ isNowDelayValid: true });
      return this.props.onNowDelayChange(value);
    }

    this.setState({ isNowDelayValid: false });
  };

  onMaxTimeRangeChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;

    if (isEmpty(value)) {
      this.setState({ isMaxTimeRangeValid: true });
      return this.props.onMaxTimeRangeChange(value);
    }

    if (value.match(/^[1-9]\d*[yMwdhms]$/)) {
      this.setState({ isMaxTimeRangeValid: true });
      return this.props.onMaxTimeRangeChange(value);
    }

    this.setState({ isMaxTimeRangeValid: false });
  };

  onOldestFromChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;

    if (isEmpty(value)) {
      this.setState({ isOldestFromValid: true });
      return this.props.onOldestFromChange(value);
    }

    if (value.match(/^[1-9]\d*[yMwdhms]$/)) {
      this.setState({ isOldestFromValid: true });
      return this.props.onOldestFromChange(value);
    }

    this.setState({ isOldestFromValid: false });
  };

  onHideTimePickerChange = () => {
    this.props.onHideTimePickerChange(!this.props.timePickerHidden);
  };

  onTimeZoneChange = (timeZone: string) => {
    if (typeof timeZone !== 'string') {
      return;
    }
    this.props.onTimeZoneChange(timeZone);
  };

  render() {
    return (
      <div className="editor-row">
        <h5 className="section-heading">Time Options</h5>
        <div className="gf-form-group">
          <div className="gf-form" aria-label={selectors.components.TimeZonePicker.container}>
            <label className="gf-form-label width-7">Timezone</label>
            <TimeZonePicker
              includeInternal={true}
              value={this.props.timezone}
              onChange={this.onTimeZoneChange}
              width={40}
            />
          </div>
          <AutoRefreshIntervals
            renderCount={this.props.renderCount}
            refreshIntervals={this.props.refreshIntervals}
            onRefreshIntervalChange={this.props.onRefreshIntervalChange}
          />
          <div className="gf-form">
            <span className="gf-form-label width-7">Now delay now-</span>
            <Tooltip
              placement="right"
              content={'Enter 1m to ignore the last minute (because it can contain incomplete metrics)'}
            >
              <Input
                width={60}
                invalid={!this.state.isNowDelayValid}
                placeholder="0m"
                onChange={this.onNowDelayChange}
                defaultValue={this.props.nowDelay}
              />
            </Tooltip>
          </div>
          <div className="gf-form">
            <span className="gf-form-label width-7">Max time range</span>
            <Tooltip
              placement="right"
              content={
                'Prevent users from choosing a time range larger than a specified time interval. The supported units are y(years), M(months), w(weeks), d(days), h(hours), m(minutes), s(seconds).'
              }
            >
              <Input
                width={60}
                invalid={!this.state.isMaxTimeRangeValid}
                onChange={this.onMaxTimeRangeChange}
                defaultValue={this.props.maxTimeRange}
              />
            </Tooltip>
          </div>

          <div className="gf-form">
            <span className="gf-form-label width-7">Oldest 'From'</span>
            <span className="gf-form-label width-3">now -</span>
            <Tooltip
              placement="right"
              content={
                'Limit how far back the start of the time range can go from now. The supported units are y(years), M(months), w(weeks), d(days), h(hours), m(minutes), s(seconds).'
              }
            >
              <Input
                width={53.5}
                invalid={!this.state.isOldestFromValid}
                onChange={this.onOldestFromChange}
                defaultValue={this.props.oldestFrom}
              />
            </Tooltip>
          </div>

          <div className="gf-form">
            <InlineField labelWidth={14} label="Hide time picker">
              <Switch value={!!this.props.timePickerHidden} onChange={this.onHideTimePickerChange} />
            </InlineField>
          </div>
        </div>
      </div>
    );
  }
}
