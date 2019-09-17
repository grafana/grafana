// Libaries
import React, { Component } from 'react';

// Types
import { ExploreId } from 'app/types';
import { TimeRange, TimeOption, TimeZone, RawTimeRange, dateTimeForTimeZone } from '@grafana/data';

// State

// Components
import { TimePicker } from '@grafana/ui';

// Utils & Services
import { defaultSelectOptions } from '@grafana/ui/src/components/TimePicker/TimePicker';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';

export interface Props {
  exploreId: ExploreId;
  range: TimeRange;
  timeZone: TimeZone;
  onChangeTime: (range: RawTimeRange) => void;
}

export class ExploreTimeControls extends Component<Props> {
  onMoveTimePicker = (direction: number) => {
    const { range, onChangeTime, timeZone } = this.props;
    const { from, to } = getShiftedTimeRange(direction, range);
    const nextTimeRange = {
      from: dateTimeForTimeZone(timeZone, from),
      to: dateTimeForTimeZone(timeZone, to),
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
      from: dateTimeForTimeZone(timeZone, from),
      to: dateTimeForTimeZone(timeZone, to),
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
    const { range, timeZone } = this.props;

    return (
      <TimePicker
        value={range}
        onChange={this.onChangeTimePicker}
        timeZone={timeZone}
        onMoveBackward={this.onMoveBack}
        onMoveForward={this.onMoveForward}
        onZoom={this.onZoom}
        selectOptions={this.setActiveTimeOption(defaultSelectOptions, range.raw)}
      />
    );
  }
}
