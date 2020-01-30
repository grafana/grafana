// Libaries
import React, { Component } from 'react';
import { dateMath, GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

// Types
import { DashboardModel } from '../../state';
import { LocationState, CoreEvents } from 'app/types';
import { TimeRange } from '@grafana/data';

// State
import { updateLocation } from 'app/core/actions';

// Components
import { RefreshPicker, withTheme, stylesFactory, Themeable } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

// Utils & Services
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      position: relative;
      display: flex;
      padding: 2px 2px;
    `,
  };
});

export interface Props extends Themeable {
  $injector: any;
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  location: LocationState;
}
class UnthemedDashNavTimeControls extends Component<Props> {
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

  render() {
    const { dashboard, theme } = this.props;
    const intervals = dashboard.timepicker.refresh_intervals;
    const timePickerValue = this.timeSrv.timeRange();
    const timeZone = dashboard.getTimezone();
    const styles = getStyles(theme);

    return (
      <div className={styles.container}>
        <TimePickerWithHistory
          value={timePickerValue}
          onChange={this.onChangeTimePicker}
          timeZone={timeZone}
          onMoveBackward={this.onMoveBack}
          onMoveForward={this.onMoveForward}
          onZoom={this.onZoom}
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

export const DashNavTimeControls = withTheme(UnthemedDashNavTimeControls);
