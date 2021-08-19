// Libraries
import React, { Component } from 'react';
import { dateMath, TimeRange, TimeZone } from '@grafana/data';

// Types
import { DashboardModel } from '../../state';

// Components
import { defaultIntervals, RefreshPicker, ToolbarButtonRow } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

// Utils & Services
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { appEvents } from 'app/core/core';
import { ShiftTimeEvent, ShiftTimeEventPayload, TimeRangeUpdatedEvent, ZoomOutEvent } from '../../../../types/events';
import { Unsubscribable } from 'rxjs';

export interface Props {
  dashboard: DashboardModel;
  onChangeTimeZone: (timeZone: TimeZone) => void;
}

export class DashNavTimeControls extends Component<Props> {
  private sub?: Unsubscribable;

  componentDidMount() {
    this.sub = this.props.dashboard.events.subscribe(TimeRangeUpdatedEvent, () => this.forceUpdate());
  }

  componentWillUnmount() {
    this.sub?.unsubscribe();
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
    appEvents.publish(new ShiftTimeEvent(ShiftTimeEventPayload.Left));
  };

  onMoveForward = () => {
    appEvents.publish(new ShiftTimeEvent(ShiftTimeEventPayload.Right));
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

  onChangeTimeZone = (timeZone: TimeZone) => {
    this.props.dashboard.timezone = timeZone;
    this.props.onChangeTimeZone(timeZone);
    this.onRefresh();
  };

  onZoom = () => {
    appEvents.publish(new ZoomOutEvent(2));
  };

  render() {
    const { dashboard } = this.props;
    const { refresh_intervals } = dashboard.timepicker;
    const intervals = getTimeSrv().getValidIntervals(refresh_intervals || defaultIntervals);

    const timePickerValue = getTimeSrv().timeRange();
    const timeZone = dashboard.getTimezone();
    const hideIntervalPicker = dashboard.panelInEdit?.isEditing;

    return (
      <ToolbarButtonRow>
        <TimePickerWithHistory
          value={timePickerValue}
          onChange={this.onChangeTimePicker}
          timeZone={timeZone}
          onMoveBackward={this.onMoveBack}
          onMoveForward={this.onMoveForward}
          onZoom={this.onZoom}
          onChangeTimeZone={this.onChangeTimeZone}
        />
        <RefreshPicker
          onIntervalChanged={this.onChangeRefreshInterval}
          onRefresh={this.onRefresh}
          value={dashboard.refresh}
          intervals={intervals}
          tooltip="Refresh dashboard"
          noIntervalPicker={hideIntervalPicker}
        />
      </ToolbarButtonRow>
    );
  }
}
