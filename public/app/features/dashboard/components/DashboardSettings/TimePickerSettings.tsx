import React, { PureComponent } from 'react';
import { TimeZonePicker, Input, Tooltip, LegacyForms } from '@grafana/ui';
import { DashboardModel } from '../../state/DashboardModel';
import { TimeZone, rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import kbn from 'app/core/utils/kbn';
import isEmpty from 'lodash/isEmpty';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  getDashboard: () => DashboardModel;
  onTimeZoneChange: (timeZone: TimeZone) => void;
  onRefreshIntervalChange: (interval: string[]) => void;
  onNowDelayChange: (nowDelay: string) => void;
  onHideTimePickerChange: (hide: boolean) => void;
}

interface State {
  isNowDelayValid: boolean;
}

export class TimePickerSettings extends PureComponent<Props, State> {
  state: State = { isNowDelayValid: true };

  componentDidMount() {
    const { timepicker } = this.props.getDashboard();
    let intervals: string[] = timepicker.refresh_intervals ?? [
      '5s',
      '10s',
      '30s',
      '1m',
      '5m',
      '15m',
      '30m',
      '1h',
      '2h',
      '1d',
    ];

    if (config.minRefreshInterval) {
      intervals = intervals.filter(rate => {
        return kbn.interval_to_ms(rate) > kbn.interval_to_ms(config.minRefreshInterval);
      });
    }

    this.props.onRefreshIntervalChange(intervals);
  }

  getRefreshIntervals = () => {
    const dashboard = this.props.getDashboard();
    if (!Array.isArray(dashboard.timepicker.refresh_intervals)) {
      return '';
    }
    return dashboard.timepicker.refresh_intervals.join(',');
  };

  onRefreshIntervalChange = (event: React.FormEvent<HTMLInputElement>) => {
    if (!event.currentTarget.value) {
      return;
    }
    const intervals = event.currentTarget.value.split(',');
    this.props.onRefreshIntervalChange(intervals);
    this.forceUpdate();
  };

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

  onHideTimePickerChange = () => {
    const dashboard = this.props.getDashboard();
    this.props.onHideTimePickerChange(!dashboard.timepicker.hidden);
    this.forceUpdate();
  };

  onTimeZoneChange = (timeZone: string) => {
    if (typeof timeZone !== 'string') {
      return;
    }
    this.props.onTimeZoneChange(timeZone);
    this.forceUpdate();
  };

  render() {
    const dashboard = this.props.getDashboard();

    return (
      <div className="editor-row">
        <h5 className="section-heading">Time Options</h5>
        <div className="gf-form-group">
          <div className="gf-form" aria-label={selectors.components.TimeZonePicker.container}>
            <label className="gf-form-label width-7">Timezone</label>
            <TimeZonePicker
              includeInternal={true}
              value={dashboard.timezone}
              onChange={this.onTimeZoneChange}
              width={40}
            />
          </div>

          <div className="gf-form">
            <span className="gf-form-label width-7">Auto-refresh</span>
            <Input width={60} defaultValue={this.getRefreshIntervals()} onBlur={this.onRefreshIntervalChange} />
          </div>
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
                defaultValue={dashboard.timepicker.nowDelay}
              />
            </Tooltip>
          </div>

          <div className="gf-form">
            <LegacyForms.Switch
              labelClass="width-7"
              label="Hide time picker"
              checked={dashboard.timepicker.hidden ?? false}
              onChange={this.onHideTimePickerChange}
            />
          </div>
        </div>
      </div>
    );
  }
}
