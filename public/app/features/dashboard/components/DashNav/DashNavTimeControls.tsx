// Libaries
import React, { Component } from 'react';
import { dateMath } from '@grafana/data';

// Types
import { DashboardModel } from '../../state';
import { LocationState, CoreEvents } from 'app/types';
import { TimeRange, TimeOption, RawTimeRange } from '@grafana/data';

// State
import { updateLocation } from 'app/core/actions';

// Components
import { TimePicker, RefreshPicker } from '@grafana/ui';

// Utils & Services
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { defaultSelectOptions } from '@grafana/ui/src/components/TimePicker/TimePicker';

export interface Props {
  $injector: any;
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  location: LocationState;
}

export class DashNavTimeControls extends Component<Props> {
  timeSrv: TimeSrv = getTimeSrv();
  $rootScope = this.props.$injector.get('$rootScope');

  componentDidMount() {
    // Only reason for this is that sometimes time updates can happen via redux location changes
    // and this happens before timeSrv has had chance to update state (as it listens to angular route-updated)
    // This can be removed after timeSrv listens redux location
    this.props.dashboard.on(CoreEvents.timeRangeUpdated, this.triggerForceUpdate);
  }

  componentWillUnmount() {
    this.props.dashboard.off(CoreEvents.timeRangeUpdated, this.triggerForceUpdate);
  }

  triggerForceUpdate = () => {
    this.forceUpdate();
  };

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

  onMoveBack = () => {
    this.$rootScope.appEvent(CoreEvents.shiftTime, -1);
  };
  onMoveForward = () => {
    this.$rootScope.appEvent(CoreEvents.shiftTime, 1);
  };

  onChangeTimePicker = (timeRange: TimeRange) => {
    const { dashboard } = this.props;
    const panel = dashboard.timepicker;
    const hasDelay = panel.nowDelay && timeRange.raw.to === 'now';

    const adjustedFrom = dateMath.isMathString(timeRange.raw.from) ? timeRange.raw.from : timeRange.from;
    const adjustedTo = dateMath.isMathString(timeRange.raw.to) ? timeRange.raw.to : timeRange.to;
    const nextRange = {
      from: adjustedFrom,
      to: hasDelay ? 'now-' + panel.nowDelay : adjustedTo,
    };

    this.timeSrv.setTime(nextRange);
  };

  onZoom = () => {
    this.$rootScope.appEvent(CoreEvents.zoomOut, 2);
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
