/**
 * Whether Composer can start on a notebook. Kept free of the session and the serializers, so the
 * restricted API and the toolbar can answer synchronously without loading them.
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type ComposerEnterCheck } from 'app/features/dashboard-scene/composer/types';

import { canEditNotebooks } from '../permissions';
import type { NotebookScene } from '../scene/NotebookScene';

/** Notebooks themselves and Composer on them: two flags, independent of the dashboard Composer flag. */
export function notebookComposerEnabled(): boolean {
  const client = getFeatureFlagClient();
  return (
    client.getBooleanValue(FlagKeys.DashboardNotebooks, false) &&
    client.getBooleanValue(FlagKeys.GrafanaNotebookComposer, false)
  );
}

/**
 * The notebook the `/notebooks/:uid` route renders, if any. One scene can be on screen twice (the route
 * and the Assistant canvas share it), so the scene cannot say where it is drawn; the route page says it.
 */
let routeNotebook: NotebookScene | undefined;

/** Called by the route page while it renders `scene`. Returns the unregister. */
export function setRouteNotebook(scene: NotebookScene): () => void {
  routeNotebook = scene;
  return () => {
    if (routeNotebook === scene) {
      routeNotebook = undefined;
    }
  };
}

export function getRouteNotebook(): NotebookScene | undefined {
  return routeNotebook;
}

/**
 * Whether Composer can start on `scene`. Only on its own route: a notebook drawn anywhere else (the
 * Assistant canvas) has no room for the floating Assistant, so it is 'unsupported' there. A notebook that
 * does not exist yet (`/notebooks/new`, a canvas draft) is unsupported too: Composer saves when it ends.
 */
export function canEnterNotebookComposer(
  scene: NotebookScene | null | undefined,
  { onRoute }: { onRoute: boolean }
): ComposerEnterCheck {
  if (!scene) {
    return { ok: false, reason: 'no_document' };
  }
  const { uid, isDraft, isComposing } = scene.state;
  if (!notebookComposerEnabled() || !onRoute || !uid || isDraft || isComposing) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!canEditNotebooks()) {
    return { ok: false, reason: 'no_permission' };
  }
  return { ok: true };
}
