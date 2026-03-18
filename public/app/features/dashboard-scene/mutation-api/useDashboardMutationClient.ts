import { SceneObject } from '@grafana/scenes';

import { getDashboardSceneFor } from '../utils/utils';

import type { DashboardMutationClient } from './DashboardMutationClient';

/**
 * React hook that retrieves the DashboardMutationClient from the nearest DashboardScene.
 *
 * Returns `undefined` if the scene has not yet activated (client not created)
 * or if there is no DashboardScene ancestor.
 */
export function useDashboardMutationClient(sceneObject: SceneObject): DashboardMutationClient | undefined {
  try {
    const dashboard = getDashboardSceneFor(sceneObject);
    return dashboard.getMutationClient();
  } catch {
    return undefined;
  }
}
