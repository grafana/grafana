import React, { Component } from 'react';
import { Unsubscribable } from 'rxjs';

import { dateMath, TimeRange, TimeZone } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { defaultIntervals, RefreshPicker } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';
import { appEvents } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { AutoRefreshInterval } from 'app/core/services/context_srv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { ShiftTimeEvent, ShiftTimeEventDirection, ZoomOutEvent } from '../../../../types/events';
import { DashboardModel } from '../../state';

export interface Props {
  dashboard: DashboardModel;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  isOnCanvas?: boolean;
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
    getTimeSrv().refreshTimeModel();
    return Promise.resolve();
  };

  onMoveBack = () => {
    appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Left }));
  };

  onMoveForward = () => {
    appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Right }));
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

  onChangeFiscalYearStartMonth = (month: number) => {
    this.props.dashboard.fiscalYearStartMonth = month;
    this.onRefresh();
  };

  onZoom = () => {
    appEvents.publish(new ZoomOutEvent({ scale: 2 }));
  };

  render() {
    const { dashboard, isOnCanvas } = this.props;
    const { refresh_intervals } = dashboard.timepicker;
    const intervals = getTimeSrv().getValidIntervals(refresh_intervals || defaultIntervals);

    const timePickerValue = getTimeSrv().timeRange();
    const timeZone = dashboard.getTimezone();
    const fiscalYearStartMonth = dashboard.fiscalYearStartMonth;
    const hideIntervalPicker = dashboard.panelInEdit?.isEditing;

    let text: string | undefined = undefined;
    if (dashboard.refresh === AutoRefreshInterval) {
      text = getTimeSrv().getAutoRefreshInteval().interval;
    }

    return (
      <>
        <TimePickerWithHistory
          value={timePickerValue}
          onChange={this.onChangeTimePicker}
          timeZone={timeZone}
          fiscalYearStartMonth={fiscalYearStartMonth}
          onMoveBackward={this.onMoveBack}
          onMoveForward={this.onMoveForward}
          onZoom={this.onZoom}
          onChangeTimeZone={this.onChangeTimeZone}
          onChangeFiscalYearStartMonth={this.onChangeFiscalYearStartMonth}
          isOnCanvas={isOnCanvas}
        />
        <RefreshPicker
          onIntervalChanged={this.onChangeRefreshInterval}
          onRefresh={this.onRefresh}
          value={dashboard.refresh}
          intervals={intervals}
          isOnCanvas={isOnCanvas}
          tooltip={t('dashboard.toolbar.refresh', 'Refresh dashboard')}
          noIntervalPicker={hideIntervalPicker}
          showAutoInterval={true}
          text={text}
        />
      </>
    );
  }
}
