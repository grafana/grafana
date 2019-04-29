// Libaries
import React, { Component } from 'react';
import moment from 'moment';

// Types
import { DashboardModel } from '../../state';
import { LocationState } from 'app/types';
import { TimeRange } from '@grafana/ui';

// State
import { updateLocation } from 'app/core/actions';

// Components
import { TimePicker, RefreshPicker } from '@grafana/ui';

// Utils & Services
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';

export interface Props {
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  location: LocationState;
}

const TimePickerTooltipContent = ({
  dashboard,
  timePickerValue,
}: {
  dashboard: DashboardModel;
  timePickerValue: TimeRange;
}) => (
  <>
    {dashboard.formatDate(timePickerValue.from)}
    <br />
    to
    <br />
    {dashboard.formatDate(timePickerValue.to)}
  </>
);

export class DashNavTimeControls extends Component<Props> {
  timeSrv: TimeSrv = getTimeSrv();

  get refreshParamInUrl(): string {
    return this.props.location.query.refresh as string;
  }

  onChangeRefreshInterval = (interval: string) => {
    this.timeSrv.setAutoRefresh(interval);
    this.forceUpdate();
  };

  onRefresh = () => {
    this.timeSrv.refreshDashboard();
    return Promise.resolve();
  };

  onMoveTimePicker = (direction: number) => {
    const range = this.timeSrv.timeRange();
    const timespan = (range.to.valueOf() - range.from.valueOf()) / 2;
    let to: number, from: number;

    if (direction === -1) {
      to = range.to.valueOf() - timespan;
      from = range.from.valueOf() - timespan;
    } else if (direction === 1) {
      to = range.to.valueOf() + timespan;
      from = range.from.valueOf() + timespan;
      if (to > Date.now() && range.to.valueOf() < Date.now()) {
        to = Date.now();
        from = range.from.valueOf();
      }
    } else {
      to = range.to.valueOf();
      from = range.from.valueOf();
    }

    this.timeSrv.setTime({
      from: moment.utc(from),
      to: moment.utc(to),
    });
  };

  onMoveForward = () => this.onMoveTimePicker(1);
  onMoveBack = () => this.onMoveTimePicker(-1);

  onChangeTimePicker = (timeRange: TimeRange) => {
    const { dashboard } = this.props;
    const panel = dashboard.timepicker;
    const hasDelay = panel.nowDelay && timeRange.raw.to === 'now';

    const nextRange = {
      from: timeRange.raw.from,
      to: hasDelay ? 'now-' + panel.nowDelay : timeRange.raw.to,
    };

    this.timeSrv.setTime(nextRange);
  };

  render() {
    const { dashboard } = this.props;
    const intervals = dashboard.timepicker.refresh_intervals;
    const timePickerValue = this.timeSrv.timeRange();
    return (
      <>
        <TimePicker
          isTimezoneUtc={false}
          value={timePickerValue}
          onChange={this.onChangeTimePicker}
          tooltipContent={<TimePickerTooltipContent dashboard={dashboard} timePickerValue={timePickerValue} />}
          onMoveBackward={this.onMoveBack}
          onMoveForward={this.onMoveForward}
          onZoom={() => {
            console.log('onZoom');
          }}
          selectOptions={TimePicker.defaultSelectOptions}
          popoverOptions={TimePicker.defaultPopoverOptions}
        />
        <RefreshPicker
          onIntervalChanged={this.onChangeRefreshInterval}
          onRefresh={this.onRefresh}
          value={dashboard.refresh}
          intervals={intervals}
          tooltip="Refresh dashboard"
        />
      </>
    );
  }
}
