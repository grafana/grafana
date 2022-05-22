import React from 'react';

import { TimeRange } from '@grafana/data';
import { RefreshPicker, ToolbarButtonRow } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

import { SceneItemBase } from './SceneItem';

interface TimeRangeState {
  timeRange: TimeRange;
  hidePicker?: boolean;
}

export class SceneTimeRange extends SceneItemBase<TimeRangeState> {
  Component = SceneTimeRangeRenderer;

  onTimeRangeChange = (timeRange: TimeRange) => {
    this.setState({ timeRange });
  };

  onRefresh = () => {
    // TODO re-eval time range
    this.setState({ ...this.state });
  };

  onIntervalChanged = (_: string) => {};
}

function SceneTimeRangeRenderer({ model }: { model: SceneTimeRange }) {
  const { hidePicker, timeRange } = model.useState();

  if (hidePicker) {
    return null;
  }

  return (
    <ToolbarButtonRow>
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

      <RefreshPicker onRefresh={model.onRefresh} onIntervalChanged={model.onIntervalChanged} />
    </ToolbarButtonRow>
  );
}
