import React from 'react';

import { TimeRange } from '@grafana/data';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

import { SceneItem } from './SceneItem';

interface TimeRangeState {
  timeRange: TimeRange;
  hidePicker?: boolean;
}

export class SceneTimeRange extends SceneItem<TimeRangeState> {
  Component = SceneTimeRangeRenderer;

  onTimeRangeChange = (timeRange: TimeRange) => {
    this.setState({ timeRange });
  };
}

function SceneTimeRangeRenderer({ model }: { model: SceneTimeRange }) {
  const { hidePicker, timeRange } = model.useState();

  if (hidePicker) {
    return null;
  }

  return (
    <TimePickerWithHistory
      value={timeRange}
      onChange={model.onTimeRangeChange}
      timeZone={'browser'}
      fiscalYearStartMonth={0}
      onMoveBackward={() => {}}
      onMoveForward={() => {}}
      onZoom={() => {}}
      onChangeTimeZone={() => {}}
      onChangeFiscalYearStartMonth={() => {}}
    />
  );
}
