import React from 'react';

import { getDefaultTimeRange } from '@grafana/data';

import { SceneTimeRangeObject } from './SceneObjectBase';
import { SceneComponentProps, SceneTimeRangeState } from './types';
import { RefreshPicker, ToolbarButtonRow } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

export class SceneTimeRange extends SceneTimeRangeObject {
  static Component = SceneTimeRangeRenderer;

  constructor(state: SceneTimeRangeState) {
    super({
      ...state,
      range: state.range || getDefaultTimeRange(),
    });
  }
}

interface SceneTimeRangeRendererProps extends SceneComponentProps<SceneTimeRange> {}

function SceneTimeRangeRenderer({ model: timeRange }: SceneTimeRangeRendererProps) {
  const state = timeRange.useState();

  return (
    <ToolbarButtonRow>
      <TimePickerWithHistory
        value={state.range!}
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
