import { isEqual, isPlainObject } from 'lodash';
import { useCallback, useRef, useSyncExternalStore } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { DashboardRoutes } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';

import {
  type PendingChangesHistory,
  type PendingChangesHistoryState,
  previewedDashboardUid,
} from './pendingChangePreview';

/**
 * What an edit changes, against the pending changes as stored: the scene saves defaults the stored
 * spec leaves out (plugin versions, option defaults), which would otherwise show as changes to
 * elements nobody touched.
 */
interface RecordingBaseline {
  /** The scene's save model before the edit. */
  serialized: DashboardV2Spec;
  /** The pending changes as stored, which the edit is recorded onto. */
  stored: DashboardV2Spec;
}

const baselines = new WeakMap<DashboardScene, RecordingBaseline>();

/** Scenes with an edit the plugin failed to record: the next recording retries it. */
const unrecorded = new WeakSet<DashboardScene>();

/** Whether an edit on `scene` hasn't reached the plugin's history, so leaving the page would lose it. */
export function hasUnrecordedPendingChange(scene: DashboardScene): boolean {
  return unrecorded.has(scene);
}

/** Starts recording edits to `scene`, which shows the pending changes `stored`, as edit mode starts. */
export function startRecordingPendingChanges(scene: DashboardScene, stored: DashboardV2Spec) {
  const serialized = scene.getSaveModel();
  if (isDashboardV2Spec(serialized)) {
    baselines.set(scene, { serialized, stored });
  }
}

/** `stored` with what changed from `before` to `after`: what didn't change keeps its stored form. */
function rebase(stored: unknown, before: unknown, after: unknown): unknown {
  if (isEqual(before, after)) {
    return stored;
  }
  if (!isRecord(stored) || !isRecord(before) || !isRecord(after)) {
    return after;
  }
  const result: Record<string, unknown> = { ...stored };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!(key in after)) {
      delete result[key];
    } else if (!isEqual(before[key], after[key])) {
      result[key] = rebase(stored[key], before[key], after[key]);
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}

/**
 * Edits to pending changes on the dashboard page (see PendingChangesHistory): the dashboard's
 * edit actions, the same ones its Undo steps through, are recorded in the plugin's history
 * instead, so an edit made by hand ends up like one the plugin made. The scene then counts as
 * saved: Exit edit has nothing to save or discard.
 */
export async function recordPendingChange(
  scene: DashboardScene,
  history: PendingChangesHistory,
  description?: string,
  before?: unknown
): Promise<void> {
  const serialized = scene.getSaveModel();
  if (!isDashboardV2Spec(serialized)) {
    return;
  }
  // The scene just before this edit, when known: defaults panels filled in since the last one, as
  // their plugins loaded, then count as unchanged instead of as the edit.
  const baseline = baselines.get(scene);
  const from = isDashboardV2Spec(before) ? before : baseline?.serialized;
  const rebased = baseline && from ? rebase(baseline.stored, from, serialized) : serialized;
  const proposed = isDashboardV2Spec(rebased) ? rebased : serialized;
  baselines.set(scene, { serialized, stored: proposed });
  // Before the request: an edit made while it runs still marks the scene changed.
  scene.markPendingChangesRecorded(serialized);
  // Only defaults the scene filled in changed: nothing to record, unless an earlier edit failed to.
  if (baseline && isEqual(proposed, baseline.stored) && !unrecorded.has(scene)) {
    return;
  }
  let recorded: boolean;
  try {
    recorded = (await history.record({ proposed, description })).recorded;
  } catch (error) {
    // `proposed` stays the baseline, so the next recording, or leaving edit mode, carries this edit.
    unrecorded.add(scene);
    appEvents.emit(AppEvents.alertError, [
      t('dashboard-scene.lifecycle.record-pending-change-failed', 'Your change could not be saved'),
      error instanceof Error ? error.message : String(error),
    ]);
    return;
  }
  unrecorded.delete(scene);
  if (!recorded) {
    appEvents.emit(AppEvents.alertWarning, [
      t('dashboard-scene.lifecycle.pending-changes-changed', 'These pending changes changed'),
      t(
        'dashboard-scene.lifecycle.pending-changes-changed-text',
        'Your last change was not saved. Showing the latest pending changes.'
      ),
    ]);
    const uid = previewedDashboardUid(scene.state);
    if (uid) {
      await reloadKeepingEditMode(uid, scene.state.isEditing);
    }
  }
}

/**
 * Loads the dashboard page again, fresh, back in edit mode when it was editing: a step through the
 * pending changes history loads a new scene, and leaves the requester where they were.
 */
export async function reloadKeepingEditMode(uid: string, editing: boolean | undefined): Promise<void> {
  const { getDashboardScenePageStateManager } = await import('../pages/DashboardScenePageStateManager');
  const manager = getDashboardScenePageStateManager();
  await manager.reloadDashboardFresh({ uid, route: DashboardRoutes.Normal });
  const reloaded = manager.state.dashboard;
  if (editing && reloaded && !reloaded.state.isEditing) {
    reloaded.onEnterEditMode();
  }
}

const noop = () => {};
const noState: PendingChangesHistoryState = {};

/**
 * The pending changes history's state, kept current; empty without a history. The same object while
 * its fields stay the same, as useSyncExternalStore needs, whether or not `getState` returns a new one.
 */
export function usePendingChangesHistoryState(history: PendingChangesHistory | undefined): PendingChangesHistoryState {
  const snapshot = useRef(noState);
  const subscribe = useCallback((listener: () => void) => history?.subscribe(listener) ?? noop, [history]);
  const getSnapshot = useCallback(() => {
    const next = history?.getState() ?? noState;
    const last = snapshot.current;
    if (next.undo !== last.undo || next.redo !== last.redo || next.proposed !== last.proposed) {
      snapshot.current = next;
    }
    return snapshot.current;
  }, [history]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
