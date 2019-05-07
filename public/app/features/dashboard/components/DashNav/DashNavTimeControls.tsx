// Libaries
import React, { Component } from 'react';
import moment from 'moment';

// Types
import { DashboardModel } from '../../state';
import { LocationState } from 'app/types';
import { TimeOptions, TimeRange, RawTimeRange, TimeOption } from '@grafana/ui';

// State
import { updateLocation } from 'app/core/actions';

// Components
import { TimePicker, RefreshPicker } from '@grafana/ui';

// Utils & Services
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getRawTimeRangeToShow } from '@grafana/ui';

export interface Props {
  $injector: any;
  dashboard: DashboardModel;
  updateLocation: typeof updateLocation;
  location: LocationState;
}

const TimePickerTooltipContent = ({
  dashboard,
  rawTimeRange,
}: {
  dashboard: DashboardModel;
  rawTimeRange: RawTimeRange;
}) => (
  <>
    {dashboard.formatDate(rawTimeRange.from)}
    <br />
    to
    <br />
    {dashboard.formatDate(rawTimeRange.to)}
  </>
);

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

  setActiveInTimeOptions = (options: TimeOptions, rawTimeRange: RawTimeRange): TimeOptions => {
    const newRange = Object.keys(options).reduce((acc: TimeOptions, currKey: string) => {
      return {
        ...acc,
        [currKey]: this.setActiveTimeOption(options[currKey], rawTimeRange),
      };
    }, {});

    return newRange;
  };

  render() {
    const { dashboard } = this.props;
    const intervals = dashboard.timepicker.refresh_intervals;
    const timePickerValue = this.timeSrv.timeRange();
    const isUtc = dashboard.isTimezoneUtc();
    return (
      <>
        <TimePicker
          isTimezoneUtc={isUtc}
          value={timePickerValue}
          onChange={this.onChangeTimePicker}
          tooltipContent={
            <TimePickerTooltipContent
              dashboard={dashboard}
              rawTimeRange={getRawTimeRangeToShow(isUtc, timePickerValue)}
            />
          }
          onMoveBackward={this.onMoveBack}
          onMoveForward={this.onMoveForward}
          onZoom={this.onZoom}
          selectOptions={this.setActiveTimeOption(TimePicker.defaultSelectOptions, timePickerValue.raw)}
          popoverOptions={this.setActiveInTimeOptions(TimePicker.defaultPopoverOptions, timePickerValue.raw)}
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
