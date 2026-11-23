import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';

import { type DashboardChangeInfo } from '../saving/shared';
import { type DashboardScene } from '../scene/DashboardScene';
import { dashboardComposerEnabled } from '../scene/dashboardModes';
import { jsonDiff } from '../settings/version-history/utils';
import { isMobileEditDeprecated } from '../utils/mobileEditDeprecation';

import {
  clearPendingChangePreview,
  getScenePendingChangePreview,
  type PendingChangePreview,
  previewedDashboardUid,
  proposesNewDashboard,
} from './pendingChangePreview';
import {
  hasUnrecordedPendingChange,
  pendingChangesRecorded,
  pendingChangesSuperseded,
  rebase,
  recordPendingChange,
} from './pendingChangesHistory';
import { closePendingChangesPage, takeEditingOnNextLoad } from './pendingChangesPageReload';
import { withoutEmptyValues } from './specDiff';

/**
 * Pending changes the dashboard page can edit are its unsaved changes (see pendingChangePreview.ts):
 * they open in edit mode, and the dashboard's own Save, Exit edit and Discard save or discard them
 * through the plugin that keeps them.
 */

/**
 * As the page loads a dashboard: pending changes it can edit open in edit mode, as the Assistant's
 * own edits do. So does the saved dashboard after Discard changes, which keeps editing.
 */
export function openPendingChangesForEditing(scene: DashboardScene) {
  const keepEditing = takeEditingOnNextLoad(previewedDashboardUid(scene.state));
  if (scene.state.isEditing || !scene.canEditDashboard() || isMobileEditDeprecated()) {
    return;
  }
  const preview = getScenePendingChangePreview(scene.state);
  if (!preview?.previewing) {
    if (keepEditing) {
      scene.onEnterEditMode();
    }
    return;
  }
  // Without the plugin's history an edit couldn't be kept, so the preview stays read-only.
  if (proposesNewDashboard(preview.pending) || preview.pending.history) {
    scene.onEnterEditMode('assistant');
    requestComposerOverAssistantEdit(scene);
  }
}

/** Dashboards whose Assistant edit the page asks the Assistant to enter Composer over, once it can. */
const composerOverAssistantEdit = new Set<string>();

/**
 * With Composer on, the Assistant's edit opens in Editing for Composer to run over. The page makes the request
 * (see `useComposerOverAssistantEdit`): it has to open the Assistant sidebar, which it can only do once the
 * sidebar knows the Assistant's component.
 */
function requestComposerOverAssistantEdit(scene: DashboardScene) {
  const uid = scene.state.uid;
  if (uid && dashboardComposerEnabled()) {
    composerOverAssistantEdit.add(uid);
  }
}

/** Whether the page should ask the Assistant to enter Composer over this dashboard's edit; asking forgets it. */
export function takeComposerRequestOverAssistantEdit(uid: string | undefined): boolean {
  return uid !== undefined && composerOverAssistantEdit.delete(uid);
}

/**
 * Whether the dashboard's Save saves pending changes to a saved dashboard: through their plugin, or,
 * for a dashboard a repository keeps, as a commit to it.
 */
export function savesPendingChanges(scene: DashboardScene): boolean {
  const preview = getScenePendingChangePreview(scene.state);
  return Boolean(preview?.previewing && preview.saved && !proposesNewDashboard(preview.pending));
}

/**
 * What the dashboard's Save would save, against the saved version it would replace, both in the form
 * the dashboard writes, as with the flag off. The saved version and the pending changes as stored
 * can spell a dashboard differently (key order, defaults one leaves out), so the saved version is
 * what the recorded pending changes change from it, on top of the dashboard's own save model.
 */
export function getPendingChangesDiff(scene: DashboardScene): DashboardChangeInfo | undefined {
  const preview = getScenePendingChangePreview(scene.state);
  if (!preview?.previewing || !preview.saved || !savesPendingChanges(scene)) {
    return undefined;
  }
  const saveModel = scene.getSaveModel();
  if (!isDashboardV2Spec(saveModel)) {
    return undefined;
  }
  const recorded = preview.pending.history?.getState().proposed ?? preview.pending.proposed;
  const saved = rebase(saveModel, recorded, preview.saved.spec);
  const initialSaveModel = withoutEmptyValues(isDashboardV2Spec(saved) ? saved : preview.saved.spec);
  const changedSaveModel = withoutEmptyValues(saveModel);
  const diffs = jsonDiff(initialSaveModel, changedSaveModel);
  const diffCount = Object.values(diffs).reduce((count, diff) => count + diff.length, 0);
  return {
    initialSaveModel,
    changedSaveModel,
    diffs,
    diffCount,
    hasChanges: diffCount > 0,
    // Save keeps the pending changes whole, time range and variable values included: nothing to opt into.
    hasTimeChanges: false,
    hasVariableValueChanges: false,
    hasRefreshChange: false,
    isNew: false,
  };
}

/**
 * A draft's changes as its save form shows them: from the blank dashboard a new one starts from, as
 * for a dashboard made from scratch, rather than from the draft as stored, which would show only the
 * defaults the scene fills in. What Save creates stays the draft as it is.
 */
export function withNewDashboardBaseline(scene: DashboardScene, changes: DashboardChangeInfo): DashboardChangeInfo {
  const preview = getScenePendingChangePreview(scene.state);
  if (!preview?.previewing || !preview.newDashboard || !proposesNewDashboard(preview.pending)) {
    return changes;
  }
  const initialSaveModel = structuredClone(preview.newDashboard);
  const diffs = jsonDiff(initialSaveModel, changes.changedSaveModel);
  const diffCount = Object.values(diffs).reduce((count, diff) => count + diff.length, 0);
  return {
    ...changes,
    initialSaveModel,
    diffs,
    diffCount,
    hasChanges: diffCount > 0 || Boolean(changes.hasFolderChanges || changes.hasPredefinedVariablesChanges),
  };
}

export type SavePendingChangesResult = { saved: true } | { saved: false; currentGeneration?: number };

/**
 * Saves the pending changes `scene` shows to the dashboard, through their plugin, once every edit
 * made here is in them. Not saved when the dashboard moved on since they started, unless `force`
 * (`currentGeneration` is where it is now), or when they changed under an edit: the page then loads
 * the newer ones for the requester to review.
 */
export async function savePendingChanges(
  scene: DashboardScene,
  { force, message }: { force: boolean; message: string }
): Promise<SavePendingChangesResult> {
  const preview = getScenePendingChangePreview(scene.state);
  const uid = previewedDashboardUid(scene.state);
  if (!preview || !uid) {
    return { saved: false };
  }
  const { pending } = preview;
  await pendingChangesRecorded(scene);
  if (pendingChangesSuperseded(scene)) {
    return { saved: false };
  }
  if (pending.history && (scene.hasUnrecordedEdits() || hasUnrecordedPendingChange(scene))) {
    await recordPendingChange(
      scene,
      pending.history,
      t('dashboard-scene.lifecycle.edited-dashboard', 'Edit dashboard')
    );
    if (hasUnrecordedPendingChange(scene) || pendingChangesSuperseded(scene)) {
      return { saved: false };
    }
  }
  // The page shows the saved dashboard after: the live watcher's own reload for this save would
  // race it and bring the saved changes back.
  dashboardWatcher.ignoreNextSave();
  let result: Awaited<ReturnType<typeof pending.apply>>;
  try {
    result = await pending.apply({ force, message });
  } catch (error) {
    dashboardWatcher.clearIgnoreSave();
    throw error;
  }
  if (!result.applied) {
    // Nothing was saved: a save someone else makes now must still reload the page.
    dashboardWatcher.clearIgnoreSave();
    return { saved: false, currentGeneration: result.currentGeneration };
  }
  clearPendingChangePreview(uid, preview.id);
  return { saved: true };
}

/**
 * Discards the pending changes `scene` shows on the page, then shows the saved dashboard, still in
 * edit mode with `keepEditing`. A discarded draft leaves nothing to show, so the page goes to the
 * dashboards list.
 */
export async function discardScenePendingChanges(scene: DashboardScene, { keepEditing = false } = {}) {
  const preview = getScenePendingChangePreview(scene.state);
  const uid = previewedDashboardUid(scene.state);
  if (!preview || !uid) {
    return;
  }
  const draft = proposesNewDashboard(preview.pending);
  // An edit still on its way, such as the one Exit edit records, would reach the plugin after the
  // discard and bring the pending changes back.
  await pendingChangesRecorded(scene);
  try {
    await preview.pending.discard();
  } catch {
    appEvents.emit(AppEvents.alertError, [
      draft
        ? t('dashboard-scene.lifecycle.discard-draft-failed', "Couldn't discard the draft. Try again.")
        : t('dashboard-scene.lifecycle.discard-pending-failed', "Couldn't discard the changes. Try again."),
    ]);
    return;
  }
  clearPendingChangePreview(uid, preview.id);
  leaveEditMode(scene, { discarded: true });
  if (draft) {
    locationService.push('/dashboards');
    return;
  }
  await closePendingChangesPage(uid, { editing: keepEditing });
}

/** After the pending changes `scene` showed on the page were saved: the saved dashboard. */
export async function showSavedPendingChanges(scene: DashboardScene, uid: string) {
  leaveEditMode(scene, { discarded: false });
  await closePendingChangesPage(uid);
}

export interface CommittedPendingChanges {
  uid: string;
  preview: PendingChangePreview;
}

/**
 * The pending changes to a saved dashboard that committing `scene` commits, when a repository keeps
 * it: its own save form saves them then (see SaveDashboardDrawer).
 */
export function getCommittedPendingChanges(scene: DashboardScene): CommittedPendingChanges | undefined {
  const preview = getScenePendingChangePreview(scene.state);
  const uid = previewedDashboardUid(scene.state);
  if (!preview?.previewing || !uid || proposesNewDashboard(preview.pending)) {
    return undefined;
  }
  return { uid, preview };
}

/**
 * After the requester committed pending changes to a repository: the commit has them, so their
 * plugin discards them, as after a copy. With `showSaved`, the commit updated the dashboard here, so
 * the page shows it saved; otherwise the requester is on its way to the branch or the copy. A failed
 * discard leaves them to the plugin.
 */
export async function finishCommittingPendingChanges(
  scene: DashboardScene,
  { uid, preview }: CommittedPendingChanges,
  { showSaved }: { showSaved: boolean }
) {
  // An embedded view's host shows the saved dashboard itself.
  const showSavedHere = showSaved && !scene.state.meta.isEmbedded;
  if (showSavedHere) {
    leaveEditMode(scene, { discarded: false });
  }
  // An edit still on its way, such as one leaving edit mode records, would reach the plugin after
  // the discard and bring the pending changes back.
  await pendingChangesRecorded(scene);
  clearPendingChangePreview(uid, preview.id);
  try {
    await preview.pending.discard();
  } catch {
    // See above.
  }
  if (showSavedHere) {
    await closePendingChangesPage(uid);
  }
}

/** Ends the edit session of pending changes that are saved or discarded: nothing is left to save. */
function leaveEditMode(scene: DashboardScene, { discarded }: { discarded: boolean }) {
  scene.setState({ isDirty: false });
  if (scene.state.isEditing) {
    scene.exitEditMode({ skipConfirm: true, restoreInitialState: discarded });
  }
}
