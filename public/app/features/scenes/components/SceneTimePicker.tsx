import React from 'react';

import { RefreshPicker, ToolbarButtonRow } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneObjectStatePlain } from '../core/types';

export interface SceneTimePickerState extends SceneObjectStatePlain {
  hidePicker?: boolean;
}

export class SceneTimePicker extends SceneObjectBase<SceneTimePickerState> {
  static Component = SceneTimePickerRenderer;
}

function SceneTimePickerRenderer({ model }: SceneComponentProps<SceneTimePicker>) {
  const { hidePicker } = model.useState();
  const timeRange = model.getTimeRange();
  const timeRangeState = timeRange.useState();

  if (hidePicker) {
    return null;
  }

  return (
    <ToolbarButtonRow alignment="right">
      <TimePickerWithHistory
        value={timeRangeState}
        onChange={timeRange.onTimeRangeChange}
        timeZone={'browser'}
        fiscalYearStartMonth={0}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
        onChangeTimeZone={() => {}}
        onChangeFiscalYearStartMonth={() => {}}
      />

      <RefreshPicker onRefresh={timeRange.onRefresh} onIntervalChanged={timeRange.onIntervalChanged} />
    </ToolbarButtonRow>
  );
}
