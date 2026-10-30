import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import type { DashboardScene } from '../scene/DashboardScene';
import { dashboardComposerEnabled, isComposerMode } from '../scene/dashboardModes';

import { type ComposerEnterCheck } from './types';

type ComposerEnterRefusalReason = Extract<ComposerEnterCheck, { ok: false }>['reason'];

/** Why Composer was refused, finer than the contract's reason. For telemetry only. */
export type ComposerEnterRefusalDetail =
  // no_document
  | 'not_mounted'
  | 'other_document'
  | 'inactive'
  // unsupported
  | 'notebook'
  | 'flag_off'
  | 'no_uid'
  | 'snapshot'
  | 'planning'
  | 'edit_panel'
  | 'edit_view'
  | 'view_panel'
  | 'already_active'
  | 'enter_failed'
  // no_permission
  | 'new_layouts_off'
  | 'cannot_edit'
  | 'managed'
  | 'not_editable';

export interface ComposerEnterRefusal {
  reason: ComposerEnterRefusalReason;
  detail: ComposerEnterRefusalDetail;
}

/**
 * Whether Composer can start on `scene`. Kept free of scene imports so the restricted API can answer
 * synchronously without loading the session module.
 */
export function canEnterComposer(scene: DashboardScene | null): ComposerEnterCheck {
  const refusal = getComposerEnterRefusal(scene);
  return refusal ? { ok: false, reason: refusal.reason } : { ok: true };
}

/** Why Composer cannot start on `scene`, as `canEnterComposer` decides, with its detail; undefined when it can. */
export function getComposerEnterRefusal(scene: DashboardScene | null): ComposerEnterRefusal | undefined {
  if (!scene?.isActive) {
    return { reason: 'no_document', detail: 'inactive' };
  }
  // v1 covers saved dashboards in the plain dashboard view only.
  const unsupported = getUnsupportedDetail(scene);
  if (unsupported) {
    return { reason: 'unsupported', detail: unsupported };
  }
  const noPermission = getNoPermissionDetail(scene);
  if (noPermission) {
    return { reason: 'no_permission', detail: noPermission };
  }
  return undefined;
}

function getUnsupportedDetail(scene: DashboardScene): ComposerEnterRefusalDetail | undefined {
  const { uid, meta, planning, editPanel, editview, viewPanel } = scene.state;
  if (!dashboardComposerEnabled()) {
    return 'flag_off';
  }
  if (!uid) {
    return 'no_uid';
  }
  if (meta.isSnapshot) {
    return 'snapshot';
  }
  if (planning) {
    return 'planning';
  }
  if (editPanel) {
    return 'edit_panel';
  }
  if (editview) {
    return 'edit_view';
  }
  if (viewPanel) {
    return 'view_panel';
  }
  if (isComposerMode(scene.state)) {
    return 'already_active';
  }
  return undefined;
}

/** What `canStillEdit` checks, then whether the dashboard is editable at all. */
function getNoPermissionDetail(scene: DashboardScene): ComposerEnterRefusalDetail | undefined {
  if (!isDashboardNewLayoutsEnabled()) {
    return 'new_layouts_off';
  }
  if (!scene.canEditDashboard()) {
    return 'cannot_edit';
  }
  if (scene.managedResourceCannotBeEdited()) {
    return 'managed';
  }
  if (!scene.state.editable) {
    return 'not_editable';
  }
  return undefined;
}

/** The edit permission APPLY_SPEC requires, re-checked by the apply gate on every write. */
export function canStillEdit(scene: DashboardScene): boolean {
  return isDashboardNewLayoutsEnabled() && scene.canEditDashboard() && !scene.managedResourceCannotBeEdited();
}
