// Libaries
import React, { Component } from 'react';

// Types
import { SelectOptionItem } from '@grafana/ui';
import { DashboardModel } from '../../state';

// State
import { updateLocation } from 'app/core/actions';

// Components
import { RefreshPicker } from '@grafana/ui';

// Utils & Services
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getIntervalFromString } from '@grafana/ui';
import {
  EMPTY_ITEM_TEXT as defaultRefreshIntervalLabel,
  defaultItem as defaultRefreshPickerItem,
} from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

export interface Props {
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  location: any;
}

export class DashNavTimeControls extends Component<Props> {
  timeSrv: TimeSrv = getTimeSrv();

  onChangeRefreshInterval = (interval: SelectOptionItem) => {
    const { dashboard } = this.props;
    const nextRefreshValue = interval.label === defaultRefreshIntervalLabel ? undefined : interval.label;
    if (nextRefreshValue !== dashboard.refresh) {
      this.timeSrv.setAutoRefresh(nextRefreshValue);
      this.onRefresh(); // We need to refresh even when setting the value to 'Off' to update the model
    }
  };

  onRefresh = () => {
    this.timeSrv.refreshDashboard();
    return Promise.resolve();
  };

  get refreshPickerValue(): SelectOptionItem {
    const { dashboard } = this.props;
    return dashboard.refresh ? getIntervalFromString(dashboard.refresh) : defaultRefreshPickerItem;
  }

  render() {
    const { dashboard } = this.props;
    const intervals = dashboard.timepicker.refresh_intervals;
    return (
      <RefreshPicker
        onIntervalChanged={this.onChangeRefreshInterval}
        onRefresh={this.onRefresh}
        initialValue={undefined}
        value={this.refreshPickerValue}
        intervals={intervals}
        tooltip="Refresh dashboard"
      />
    );
  }
}
