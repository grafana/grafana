// Libaries
import React, { Component } from 'react';

// Types
import { ExploreId } from 'app/types';
import { TimeRange, TimeZone, RawTimeRange, dateTimeForTimeZone, dateMath } from '@grafana/data';

// State

// Components
import { TimeSyncButton } from './TimeSyncButton';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

// Utils & Services
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';

export interface Props {
  exploreId: ExploreId;
  hideText?: boolean;
  range: TimeRange;
  timeZone: TimeZone;
  fiscalYearStartMonth: number;
  splitted: boolean;
  syncedTimes: boolean;
  onChangeTimeSync: () => void;
  onChangeTime: (range: RawTimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  onChangeFiscalYearStartMonth: (fiscalYearStartMonth: number) => void;
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
    const adjustedFrom = dateMath.isMathString(timeRange.raw.from) ? timeRange.raw.from : timeRange.from;
    const adjustedTo = dateMath.isMathString(timeRange.raw.to) ? timeRange.raw.to : timeRange.to;

    this.props.onChangeTime({
      from: adjustedFrom,
      to: adjustedTo,
    });
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

  render() {
    const {
      range,
      timeZone,
      fiscalYearStartMonth,
      splitted,
      syncedTimes,
      onChangeTimeSync,
      hideText,
      onChangeTimeZone,
      onChangeFiscalYearStartMonth,
    } = this.props;
    const timeSyncButton = splitted ? <TimeSyncButton onClick={onChangeTimeSync} isSynced={syncedTimes} /> : undefined;
    const timePickerCommonProps = {
      value: range,
      timeZone,
      fiscalYearStartMonth,
      onMoveBackward: this.onMoveBack,
      onMoveForward: this.onMoveForward,
      onZoom: this.onZoom,
      hideText,
    };

    return (
      <TimePickerWithHistory
        {...timePickerCommonProps}
        timeSyncButton={timeSyncButton}
        isSynced={syncedTimes}
        onChange={this.onChangeTimePicker}
        onChangeTimeZone={onChangeTimeZone}
        onChangeFiscalYearStartMonth={onChangeFiscalYearStartMonth}
      />
    );
  }
}
