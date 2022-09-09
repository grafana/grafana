import React from 'react';

import { dateMath, getDefaultTimeRange } from '@grafana/data';

import { SceneTimeRangeObject } from './SceneObjectBase';
import { SceneComponentProps, SceneTimeRangeState } from './types';
import { RefreshPicker, ToolbarButtonRow } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

export class SceneTimeRange extends SceneTimeRangeObject {
  static Component = SceneTimeRangeRenderer;

  constructor(state: SceneTimeRangeState) {
    debugger;
    super({
      ...state,
      range: state.range
        ? {
            // TODO: add timezone and fiscal year support
            from: dateMath.parse(state.range.from, false)!,
            to: dateMath.parse(state.range.to, false)!,
            raw: state.range.raw
              ? state.range.raw
              : {
                  from: state.range.from,
                  to: state.range.to,
                },
          }
        : getDefaultTimeRange(),
    });
  }

  toJSON() {
    return {
      range: {
        from: this.state.range?.raw.from,
        to: this.state.range?.raw.to,
      },
    };
  }
}

interface SceneTimeRangeRendererProps extends SceneComponentProps<SceneTimeRange> {}

function SceneTimeRangeRenderer({ model }: SceneTimeRangeRendererProps) {
  const state = model.useState();
  return (
    <ToolbarButtonRow>
      <TimePickerWithHistory
        value={state.range!}
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
