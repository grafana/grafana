import { SceneObject } from '@grafana/scenes';

import { getDashboardSceneFor } from '../utils/utils';

import type { MutationClient } from './types';

/**
 * React hook that retrieves the {@link MutationClient} from the nearest DashboardScene.
 *
 * Returns the interface (not the concrete class) so consumers stay decoupled from
 * DashboardScene internals. Returns `undefined` when no DashboardScene ancestor exists.
 *
 * Intended for UI edit components (panel editors, settings views) that route changes
 * through the mutation pipeline instead of manipulating the scene graph directly.
 * Future consumers include plugins (via RestrictedGrafanaApis) and AI/assistant tools.
 */
export function useDashboardMutationClient(sceneObject: SceneObject): MutationClient | undefined {
  let dashboard;
  try {
    dashboard = getDashboardSceneFor(sceneObject);
  } catch {
    return undefined;
  }
  return dashboard.getMutationClient();
}
