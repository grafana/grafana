import {
  type SceneRefreshPicker,
  type SceneTimePicker,
  SceneTimeRange,
  type SceneTimeRangeLike,
} from '@grafana/scenes';
import { defaultTimeSettingsSpec, type TimeSettingsSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * Shared scene ⇄ save-model pieces for `timeSettings`, composed by both the dashboard transforms
 * and sibling resources that render through the scene runtime with their own root.
 */

/** spec → scene. Extracted verbatim from transformSaveModelSchemaV2ToScene. */
export function buildSceneTimeRange(timeSettings: TimeSettingsSpec): SceneTimeRange {
  return new SceneTimeRange({
    // Use defaults when time is empty to match DashboardModel behavior
    from: timeSettings.from || defaultTimeSettingsSpec().from,
    to: timeSettings.to || defaultTimeSettingsSpec().to,
    fiscalYearStartMonth: timeSettings.fiscalYearStartMonth,
    timeZone: timeSettings.timezone,
    weekStart: timeSettings.weekStart,
    UNSAFE_nowDelay: timeSettings.nowDelay,
  });
}

/**
 * `fiscalYearStartMonth` is required on the strict spec but a scene may legitimately not carry it
 * (e.g. a new dashboard); serializing must keep it absent rather than defaulting it, or save-model
 * diffs would report changes the user never made. Callers that need the strict spec (the notebook,
 * whose loaded spec always carries it) finalize the field themselves.
 */
export type SerializedTimeSettings = Omit<TimeSettingsSpec, 'fiscalYearStartMonth'> & {
  fiscalYearStartMonth?: number;
};

interface TimeControlsLike {
  timePicker?: SceneTimePicker;
  refreshPicker?: SceneRefreshPicker;
  hideTimeControls?: boolean;
}

/** scene → spec. Extracted verbatim from transformSceneToSaveModelSchemaV2. */
export function buildTimeSettingsSpec(
  timeRange: SceneTimeRangeLike,
  controls: TimeControlsLike
): SerializedTimeSettings {
  const timeSettingsDefaults = defaultTimeSettingsSpec();
  const timeRangeState = timeRange.state;
  const { timePicker, refreshPicker, hideTimeControls } = controls;

  return {
    timezone: timeRangeState.timeZone || timeSettingsDefaults.timezone,
    from: timeRangeState.from,
    to: timeRangeState.to,
    autoRefresh: refreshPicker?.state.refresh || timeSettingsDefaults.autoRefresh,
    autoRefreshIntervals: refreshPicker?.state.intervals || timeSettingsDefaults.autoRefreshIntervals,
    hideTimepicker: hideTimeControls || timeSettingsDefaults.hideTimepicker,
    weekStart: timeRangeState.weekStart,
    fiscalYearStartMonth: timeRangeState.fiscalYearStartMonth,
    nowDelay: timeRangeState.UNSAFE_nowDelay,
    quickRanges: timePicker?.state.quickRanges,
  };
}
