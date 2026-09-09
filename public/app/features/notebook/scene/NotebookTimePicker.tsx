import { useMemo } from 'react';

import { type TimeRange, toUtc } from '@grafana/data';
import { type SceneComponentProps, sceneGraph, SceneTimePicker } from '@grafana/scenes';
import { TimeRangePicker } from '@grafana/ui';

/**
 * The notebook's time range, as a fixed window rather than a relative one.
 *
 * A subclass rather than a replacement because only the renderer differs: SceneTimePickerState has no
 * way to hide the quick ranges, but its state and handlers are all still wanted.
 */
export class NotebookTimePicker extends SceneTimePicker {
  public static Component = NotebookTimePickerRenderer;
}

function NotebookTimePickerRenderer({ model }: SceneComponentProps<NotebookTimePicker>) {
  const { hidePicker, isOnCanvas } = model.useState();
  const sceneTimeRange = sceneGraph.getTimeRange(model);
  const { value, fiscalYearStartMonth, weekStart } = sceneTimeRange.useState();
  // getTimeZone rather than the state field: it falls back to the default when the range carries none.
  const timeZone = sceneTimeRange.getTimeZone();

  // A notebook records a moment, so the picker says which six hours rather than "Last 6 hours".
  // Display only, so a notebook saved with a relative range keeps it until someone picks a new one.
  const displayValue = useMemo((): TimeRange => {
    const from = toUtc(value.from);
    const to = toUtc(value.to);
    return { from, to, raw: { from, to } };
  }, [value]);

  if (hidePicker) {
    return null;
  }

  // hideQuickRanges takes the presets away, but the From/To fields still accept `now-6h` and
  // convertRawToRange deliberately keeps the math string in `raw`. This is what pins it.
  const onPick = (picked: TimeRange) => {
    const from = toUtc(picked.from);
    const to = toUtc(picked.to);
    sceneTimeRange.onTimeRangeChange({ from, to, raw: { from, to } });
  };

  return (
    <TimeRangePicker
      isOnCanvas={isOnCanvas ?? true}
      value={displayValue}
      timeZone={timeZone}
      fiscalYearStartMonth={fiscalYearStartMonth}
      weekStart={weekStart}
      onChange={onPick}
      onChangeTimeZone={sceneTimeRange.onTimeZoneChange}
      onChangeFiscalYearStartMonth={model.onChangeFiscalYearStartMonth}
      // Inherited, and safe to keep: both compute from the resolved range and hand back absolute ends.
      onMoveBackward={model.onMoveBackward}
      onMoveForward={model.onMoveForward}
      onZoom={model.onZoom}
      hideQuickRanges
    />
  );
}
