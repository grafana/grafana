import html2canvas from 'html2canvas';
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
import { getDashboardSrv } from '../../services/DashboardSrv';
import { DashboardModel } from '../../state';

export interface Props {
  dashboard: DashboardModel;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  isOnCanvas?: boolean;
  onToolbarRefreshClick?: () => void;
  onToolbarZoomClick?: () => void;
  onToolbarTimePickerClick?: () => void;
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
    if (this.props.onToolbarZoomClick) {
      this.props.onToolbarZoomClick();
    }
    appEvents.publish(new ZoomOutEvent({ scale: 2 }));
  };

  onRefreshClick = () => {
    const dashboardSrv = getDashboardSrv();
    const { dashboard } = this.props;
    /*
      TODO: this is probably not a good time to actually take a screenshot, it just seemed easy.
      Ideally we'd take it whenever the dashboard finishes loading. 
      Also I don't think it really makes sense to store this screenshot on the dashboard object, it was just easy.
      Right now fires off "dashboard saved" notification which is odd feeling.
      But all of this seemed "good enough" for a proof of concept 
    */
    const dash = document.getElementById("dashboard-screenshot");
    if (dash) {
      html2canvas(dash, {backgroundColor:null}).then(function(canvas: HTMLCanvasElement) {
        canvas.toBlob((b) => {
          if (b) {
            blobToBase64(b).then(s =>{
              if (s) {
                dashboardSrv.saveDashboard({ dashboard, screenshot: s as string })
              }
            })
          }
        })
    })
    }

  
    if (this.props.onToolbarRefreshClick) {
      this.props.onToolbarRefreshClick();
    }
    this.onRefresh();
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
          onToolbarTimePickerClick={this.props.onToolbarTimePickerClick}
        />
        <RefreshPicker
          onIntervalChanged={this.onChangeRefreshInterval}
          onRefresh={this.onRefreshClick}
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

function blobToBase64(blob: Blob): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
