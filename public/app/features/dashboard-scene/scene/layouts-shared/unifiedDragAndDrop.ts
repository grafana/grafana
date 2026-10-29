import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

/**
 * The new drag and drop engine and the new custom grid in dashboard edit sessions. Every place that
 * switches between the old and the new path checks this, so the switch points are easy to find.
 */
export function isUnifiedDragAndDropEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardUnifiedDragAndDrop, false);
}

/**
 * The new custom grid in view mode as well. Only takes effect together with the edit flag, so the
 * supported states are: both off, edit only, and both on.
 */
export function isNewGridViewEnabled(): boolean {
  return (
    isUnifiedDragAndDropEnabled() && getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardNewGridView, false)
  );
}
