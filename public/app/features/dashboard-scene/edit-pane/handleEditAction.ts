import { VizPanel } from '@grafana/scenes';

import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';

import { DashboardEditActionEventPayload } from './shared';

/**
 * Handles logic like making sure repeats are updated when
 * some edit changes happen
 */
export function handleEditAction({ sceneObj, perform }: DashboardEditActionEventPayload) {
  perform();

  if (sceneObj instanceof VizPanel) {
    const layoutElement = sceneObj.parent!;

    if (isDashboardLayoutItem(layoutElement) && layoutElement.editingCompleted) {
      layoutElement.editingCompleted(true);
    }
  }

  // Notify change tracker to re-run dirty check
  // I much prefer this manual edit action event than the messy ChangeTracker
  // that tries to subscribe to all possible scene object state event changes

  //   const dashboard = getDashboardSceneFor(sceneObj);
  //   if (dashboard) {
  //     dashboard.checkDirtyState();
  //   }
}
