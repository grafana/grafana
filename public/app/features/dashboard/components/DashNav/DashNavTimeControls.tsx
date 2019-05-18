// Libaries
import React, { Component } from 'react';

// Types
import { DashboardModel } from '../../state';
import { LocationState } from 'app/types';

// State
import { updateLocation } from 'app/core/actions';

// Components
import { RefreshPicker } from '@grafana/ui';

// Utils & Services
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';

export interface Props {
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  location: LocationState;
}

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

  render() {
    const { dashboard } = this.props;
    const intervals = dashboard.timepicker.refresh_intervals;
    return (
      <RefreshPicker
        onIntervalChanged={this.onChangeRefreshInterval}
        onRefresh={this.onRefresh}
        value={dashboard.refresh}
        intervals={intervals}
        tooltip="Refresh dashboard"
      />
    );
  }
}
