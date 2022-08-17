import React from 'react';

import { TimeRange, UrlQueryMap } from '@grafana/data';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneComponentProps, SceneObjectWithUrlSync, SceneTimeRangeState } from './types';
import { RefreshPicker, ToolbarButtonRow } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';

export class SceneTimeRange extends SceneObjectBase<SceneTimeRangeState> implements SceneObjectWithUrlSync {
  static Component = SceneTimeRangeRenderer;

  onTimeRangeChange = (range: TimeRange) => {
    this.setState({ range });
  };

  onRefresh = () => {
    // TODO re-eval time range
    this.setState({ ...this.state });
  };

  onIntervalChanged = (_: string) => {};

  /** These url sync functions are only placeholders for something more sophisticated  */
  getUrlState() {
    return {
      from: this.state.range.raw.from,
      to: this.state.range.raw.to,
    } as any;
  }

  updateFromUrl(values: UrlQueryMap) {
    // TODO
  }

  getTimeRange(): SceneTimeRange {
    return this;
  }
}

interface SceneTimeRangeRendererProps extends SceneComponentProps<SceneTimeRange> {}

function SceneTimeRangeRenderer({ model: timeRange }: SceneTimeRangeRendererProps) {
  const state = timeRange.useState();

  return (
    <ToolbarButtonRow>
      <TimePickerWithHistory
        value={state.range}
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
