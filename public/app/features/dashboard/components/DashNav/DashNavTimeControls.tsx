// Libaries
import React, { Component } from 'react';
import { toUtc } from '@grafana/ui/src/utils/moment_wrapper';

// Types
import { DashboardModel } from '../../state';
import { LocationState } from 'app/types';
import { TimeRange, TimeOption } from '@grafana/ui';

// State
import { updateLocation } from 'app/core/actions';

// Components
import { TimePicker, RefreshPicker, RawTimeRange } from '@grafana/ui';

// Utils & Services
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { defaultSelectOptions } from '@grafana/ui/src/components/TimePicker/TimePicker';
import { getShiftedTimeRange } from 'app/core/utils/timePicker';

export interface Props {
  $injector: any;
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  location: LocationState;
}

export class DashNavTimeControls extends Component<Props> {
  timeSrv: TimeSrv = getTimeSrv();
  $rootScope = this.props.$injector.get('$rootScope');

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
    const { from, to } = getShiftedTimeRange(direction, range);

    this.timeSrv.setTime({
      from: toUtc(from),
      to: toUtc(to),
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

  onZoom = () => {
    this.$rootScope.appEvent('zoom-out', 2);
  };

  setActiveTimeOption = (timeOptions: TimeOption[], rawTimeRange: RawTimeRange): TimeOption[] => {
    return timeOptions.map(option => {
      if (option.to === rawTimeRange.to && option.from === rawTimeRange.from) {
        return {
          ...option,
          active: true,
        };
      }
      return {
        ...option,
        active: false,
      };
    });
  };

  render() {
    const { dashboard } = this.props;
    const intervals = dashboard.timepicker.refresh_intervals;
    const timePickerValue = this.timeSrv.timeRange();
    const timeZone = dashboard.getTimezone();

    return (
      <div className="dashboard-timepicker-wrapper">
        <TimePicker
          value={timePickerValue}
          onChange={this.onChangeTimePicker}
          timeZone={timeZone}
          onMoveBackward={this.onMoveBack}
          onMoveForward={this.onMoveForward}
          onZoom={this.onZoom}
          selectOptions={this.setActiveTimeOption(defaultSelectOptions, timePickerValue.raw)}
        />
        <RefreshPicker
          onIntervalChanged={this.onChangeRefreshInterval}
          onRefresh={this.onRefresh}
          value={dashboard.refresh}
          intervals={intervals}
          tooltip="Refresh dashboard"
        />
      </div>
    );
  }
}
