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
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { appEvents } from 'app/core/core';

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
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  location: LocationState;
}
class UnthemedDashNavTimeControls extends Component<Props> {
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
    getTimeSrv().setAutoRefresh(interval);
    this.forceUpdate();
  };

  onRefresh = () => {
    getTimeSrv().refreshDashboard();
    return Promise.resolve();
  };

  onMoveBack = () => {
    appEvents.emit(CoreEvents.shiftTime, -1);
  };

  onMoveForward = () => {
    appEvents.emit(CoreEvents.shiftTime, 1);
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

    getTimeSrv().setTime(nextRange);
  };

  onZoom = () => {
    appEvents.emit(CoreEvents.zoomOut, 2);
  };

  render() {
    const { dashboard, theme } = this.props;
    const intervals = dashboard.timepicker.refresh_intervals;
    const timePickerValue = getTimeSrv().timeRange();
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
