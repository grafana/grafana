// Libaries
import React, { Component } from 'react';

// Types
import { ExploreId } from 'app/types';
import { TimeRange, TimeOption, TimeZone, SetInterval, toUtc, dateTime } from '@grafana/ui';

// State

// Components
import { TimePicker, RefreshPicker, RawTimeRange } from '@grafana/ui';

// Utils & Services
import { defaultSelectOptions } from '@grafana/ui/src/components/TimePicker/TimePicker';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';

export interface Props {
  exploreId: ExploreId;
  hasLiveOption: boolean;
  isLive: boolean;
  loading: boolean;
  range: TimeRange;
  refreshInterval: string;
  timeZone: TimeZone;
  onRunQuery: () => void;
  onChangeRefreshInterval: (interval: string) => void;
  onChangeTime: (range: RawTimeRange) => void;
}

export class ExploreTimeControls extends Component<Props> {
  onMoveTimePicker = (direction: number) => {
    const { range, onChangeTime, timeZone } = this.props;
    const { from, to } = getShiftedTimeRange(direction, range);
    const nextTimeRange = {
      from: timeZone === 'utc' ? toUtc(from) : dateTime(from),
      to: timeZone === 'utc' ? toUtc(to) : dateTime(to),
    };

    onChangeTime(nextTimeRange);
  };

  onMoveForward = () => this.onMoveTimePicker(1);
  onMoveBack = () => this.onMoveTimePicker(-1);

  onChangeTimePicker = (timeRange: TimeRange) => {
    this.props.onChangeTime(timeRange.raw);
  };

  onZoom = () => {
    const { range, onChangeTime, timeZone } = this.props;
    const { from, to } = getZoomedTimeRange(range, 2);
    const nextTimeRange = {
      from: timeZone === 'utc' ? toUtc(from) : dateTime(from),
      to: timeZone === 'utc' ? toUtc(to) : dateTime(to),
    };

    onChangeTime(nextTimeRange);
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
    const {
      hasLiveOption,
      isLive,
      loading,
      range,
      refreshInterval,
      timeZone,
      onRunQuery,
      onChangeRefreshInterval,
    } = this.props;

    return (
      <>
        {!isLive && (
          <TimePicker
            value={range}
            onChange={this.onChangeTimePicker}
            timeZone={timeZone}
            onMoveBackward={this.onMoveBack}
            onMoveForward={this.onMoveForward}
            onZoom={this.onZoom}
            selectOptions={this.setActiveTimeOption(defaultSelectOptions, range.raw)}
          />
        )}

        <RefreshPicker
          onIntervalChanged={onChangeRefreshInterval}
          onRefresh={onRunQuery}
          value={refreshInterval}
          tooltip="Refresh"
          hasLiveOption={hasLiveOption}
        />
        {refreshInterval && <SetInterval func={onRunQuery} interval={refreshInterval} loading={loading} />}
      </>
    );
  }
}
