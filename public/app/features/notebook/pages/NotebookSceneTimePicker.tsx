import { dateTime, intervalToAbbreviatedDurationString } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type SceneTimePicker } from '@grafana/scenes';
import { TimeRangePicker } from '@grafana/ui';
import { getZoomedTimeRange } from 'app/core/utils/timePicker';

/**
 * View-page time picker that mirrors SceneTimePicker but also exposes zoom-in.
 * SceneTimePicker in @grafana/scenes only wires zoom-out today.
 */
export function NotebookSceneTimePicker({ model }: { model: SceneTimePicker }) {
  const { hidePicker, isOnCanvas, quickRanges } = model.useState();
  const timeRange = sceneGraph.getTimeRange(model);
  const timeZone = timeRange.getTimeZone();
  const { value, fiscalYearStartMonth, weekStart } = timeRange.useState();

  if (hidePicker) {
    return null;
  }

  const halfSpanMs = (value.to.valueOf() - value.from.valueOf()) / 2;
  const moveBackwardDuration = intervalToAbbreviatedDurationString({
    start: new Date(value.from.valueOf()),
    end: new Date(value.from.valueOf() + halfSpanMs),
  });
  const canMoveForward = value.to.valueOf() + halfSpanMs <= Date.now();
  const moveForwardDuration = canMoveForward ? moveBackwardDuration : undefined;

  const zoomBy = (factor: number) => {
    const zoomed = getZoomedTimeRange(value, factor);
    const from = dateTime(zoomed.from);
    const to = dateTime(zoomed.to);
    timeRange.onTimeRangeChange({ from, to, raw: { from, to } });
  };

  return (
    <TimeRangePicker
      isOnCanvas={isOnCanvas ?? true}
      value={value}
      timeZone={timeZone}
      fiscalYearStartMonth={fiscalYearStartMonth}
      weekStart={weekStart}
      quickRanges={quickRanges}
      onChange={(range) => timeRange.onTimeRangeChange(range)}
      onChangeTimeZone={timeRange.onTimeZoneChange}
      onMoveBackward={() => model.onMoveBackward()}
      onMoveForward={() => model.onMoveForward()}
      moveBackwardTooltip={t('notebook.time-picker.move-backward-tooltip', 'Move {{duration}} backward', {
        duration: moveBackwardDuration,
      })}
      moveForwardTooltip={
        moveForwardDuration
          ? t('notebook.time-picker.move-forward-tooltip', 'Move {{duration}} forward', {
              duration: moveForwardDuration,
            })
          : undefined
      }
      onZoom={() => zoomBy(2)}
      onZoomIn={() => zoomBy(0.5)}
    />
  );
}
