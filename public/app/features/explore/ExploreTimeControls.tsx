import { TimeRange, RawTimeRange, dateTimeForTimeZone, dateMath } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';

import { TimeSyncButton } from './TimeSyncButton';

export interface Props {
  exploreId: string;
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

export const ExploreTimeControls = ({
  range,
  timeZone,
  fiscalYearStartMonth,
  splitted,
  syncedTimes,
  onChangeTimeSync,
  hideText,
  onChangeTimeZone,
  onChangeFiscalYearStartMonth,
  onChangeTime,
}: Props) => {
  const onMoveTimePicker = (direction: number) => {
    const { from, to } = getShiftedTimeRange(direction, range);
    const nextTimeRange = {
      from: dateTimeForTimeZone(timeZone, from),
      to: dateTimeForTimeZone(timeZone, to),
    };

    onChangeTime(nextTimeRange);
  };

  const onMoveForward = () => onMoveTimePicker(1);
  const onMoveBack = () => onMoveTimePicker(-1);

  const onChangeTimePicker = (timeRange: TimeRange) => {
    const adjustedFrom = dateMath.isMathString(timeRange.raw.from) ? timeRange.raw.from : timeRange.from;
    const adjustedTo = dateMath.isMathString(timeRange.raw.to) ? timeRange.raw.to : timeRange.to;

    onChangeTime({
      from: adjustedFrom,
      to: adjustedTo,
    });

    reportInteraction('grafana_explore_time_picker_time_range_changed', {
      timeRangeFrom: adjustedFrom,
      timeRangeTo: adjustedTo,
    });
  };

  const onZoom = () => {
    const { from, to } = getZoomedTimeRange(range, 2);
    const nextTimeRange = {
      from: dateTimeForTimeZone(timeZone, from),
      to: dateTimeForTimeZone(timeZone, to),
    };

    onChangeTime(nextTimeRange);
  };

  const timeSyncButton = splitted ? <TimeSyncButton onClick={onChangeTimeSync} isSynced={syncedTimes} /> : undefined;
  const timePickerCommonProps = {
    value: range,
    timeZone,
    fiscalYearStartMonth,
    onMoveBackward: onMoveBack,
    onMoveForward: onMoveForward,
    onZoom: onZoom,
    hideText,
  };

  return (
    <TimePickerWithHistory
      isOnCanvas
      {...timePickerCommonProps}
      timeSyncButton={timeSyncButton}
      isSynced={syncedTimes}
      widthOverride={splitted ? window.innerWidth / 2 : undefined}
      onChange={onChangeTimePicker}
      onChangeTimeZone={onChangeTimeZone}
      onChangeFiscalYearStartMonth={onChangeFiscalYearStartMonth}
    />
  );
};
