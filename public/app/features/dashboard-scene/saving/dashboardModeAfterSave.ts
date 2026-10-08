// First save and Save as copy load a new scene. Preserve the mode choice only
// for that navigation, without turning it into a persistent dashboard preference.
import { type DashboardMode } from '../scene/dashboardModes';

let pendingMode: { uid: string; mode: DashboardMode } | undefined;

export function setDashboardModeAfterSave(uid: string, mode: DashboardMode) {
  pendingMode = { uid, mode };
}

export function consumeDashboardModeAfterSave(uid: string): DashboardMode | undefined {
  const mode = pendingMode?.uid === uid ? pendingMode.mode : undefined;
  pendingMode = undefined;
  return mode;
}
