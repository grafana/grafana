import React, { PureComponent } from 'react';
import { Select, Input } from '@grafana/ui';
import { DashboardModel } from '../../state/DashboardModel';
import { getTimeZoneGroups, TimeZone } from '@grafana/data';
import { config } from '@grafana/runtime';
import kbn from 'app/core/utils/kbn';

const grafanaTimeZones = [
  { value: '', label: 'Default' },
  { value: 'browser', label: 'Local browser time' },
  { value: 'utc', label: 'UTC' },
];

const timeZones = getTimeZoneGroups().reduce((tzs, group) => {
  const options = group.options.map(tz => ({ value: tz, label: tz }));
  tzs.push.apply(tzs, options);
  return tzs;
}, grafanaTimeZones);

interface Props {
  dashboard: DashboardModel;
}

export class TimePickerSettings extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);

    const { dashboard } = props;
    const { timepicker } = dashboard;

    timepicker.refresh_intervals = timepicker.refresh_intervals || [
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
      timepicker.refresh_intervals = this.filterRefreshRates(timepicker.refresh_intervals);
    }
  }

  onTimeZoneChanged = (timeZone: TimeZone) => {
    this.props.dashboard.timezone = timeZone;
  };

  getRefreshIntervals = () => {
    return this.props.dashboard.timezone.refresh_intervals;
  };

  onRefreshIntervalChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.props.dashboard.timezone.refresh_intervals = event.currentTarget.value;
  };

  render() {
    const { dashboard } = this.props;
    const value = timeZones.find(item => item.value === dashboard.timezone);

    return (
      <div className="editor-row">
        <h5 className="section-heading">Time Options</h5>
        <div className="gf-form-group">
          <div className="gf-form">
            <label className="gf-form-label width-10">Timezone</label>

            <Select
              isSearchable={true}
              value={value}
              onChange={timezone => this.onTimeZoneChanged(timezone.value)}
              options={timeZones}
              width={20}
            />
          </div>

          <div className="gf-form">
            <span className="gf-form-label width-10">Auto-refresh</span>
            <Input value={this.getRefreshIntervals()} onChange={this.onRefreshIntervalChange} />
            {/* <input type="text" className="gf-form-input max-width-25" ng-model="ctrl.panel.refresh_intervals" array-join> */}
          </div>
          <div className="gf-form">
            <span className="gf-form-label width-10">Now delay now-</span>
            <Input placeholder="0m" />
            {/* <input type="text" className="gf-form-input max-width-25" ng-model="ctrl.panel.nowDelay"
                    placeholder="0m"
                    valid-time-span
                    bs-tooltip="'Enter 1m to ignore the last minute (because it can contain incomplete metrics)'"
                        data-placement="right"> */}
          </div>

          {/* <gf-form-switch className="gf-form" label="Hide time picker" checked="ctrl.panel.hidden" label-className="width-10">
            </gf-form-switch> */}
        </div>
      </div>
    );
  }

  private filterRefreshRates(refreshRates: string[]) {
    return refreshRates.filter(rate => {
      return kbn.interval_to_ms(rate) > kbn.interval_to_ms(config.minRefreshInterval);
    });
  }
}
