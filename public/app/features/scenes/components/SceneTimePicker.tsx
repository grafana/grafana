import React from 'react';

import { TimeRange } from '@grafana/data';
import { RefreshPicker, ToolbarButtonRow } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneObjectState } from '../core/types';

export interface SceneTimePickerState extends SceneObjectState {
  hidePicker?: boolean;
}

export class SceneTimePicker extends SceneObjectBase<SceneTimePickerState> {
  static Component = SceneTimePickerRenderer;

  onTimeRangeChange = (timeRange: TimeRange) => {
    this.getTimeRange().setState(timeRange);
  };

  onRefresh = () => {
    // TODO re-eval time range
    const timeRange = this.getTimeRange();
    timeRange.setState({ ...timeRange.state });
  };

  onIntervalChanged = (_: string) => {};
}

function SceneTimePickerRenderer({ model }: SceneComponentProps<SceneTimePicker>) {
  const { hidePicker } = model.useState();
  const timeRange = model.getTimeRange().useState();

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
