import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import type { DashboardScene } from '../scene/DashboardScene';
import { dashboardComposerEnabled, isComposerMode } from '../scene/dashboardModes';

import { type ComposerEnterCheck } from './types';

/**
 * Whether Composer can start on `scene`. Kept free of scene imports so the restricted API can answer
 * synchronously without loading the session module.
 */
export function canEnterComposer(scene: DashboardScene | null): ComposerEnterCheck {
  if (!scene?.isActive) {
    return { ok: false, reason: 'no_document' };
  }
  const { uid, meta, planning, editPanel, editview, viewPanel, editable } = scene.state;
  // v1 covers saved dashboards in the plain dashboard view only.
  if (
    !dashboardComposerEnabled() ||
    !uid ||
    meta.isSnapshot ||
    planning ||
    editPanel ||
    editview ||
    viewPanel ||
    isComposerMode(scene.state)
  ) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!canStillEdit(scene) || !editable) {
    return { ok: false, reason: 'no_permission' };
  }
  return { ok: true };
}

/** The edit permission APPLY_SPEC requires, re-checked by the apply gate on every write. */
export function canStillEdit(scene: DashboardScene): boolean {
  return isDashboardNewLayoutsEnabled() && scene.canEditDashboard() && !scene.managedResourceCannotBeEdited();
}
