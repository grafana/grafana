import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { dispatch } from 'app/store/store';

import { type PlanningAction } from '../../scene/planningPolicy';
import { findDashboardSceneFor } from '../../utils/utils';

/**
 * Refuses a user-driven variable mutation (add/remove/rename/reorder) while a plan is being
 * previewed, and tells the user why instead of failing silently.
 *
 * A plan's own placeholder variables are added and removed through the mutation API, not these
 * sidebar actions, so this only ever blocks the user's own edits — never the assistant's.
 * `source` is any scene object under the variable being mutated; `findDashboardSceneFor` walks up
 * to find the root, returning `undefined` outside a dashboard scene, where nothing is planning.
 */
export function refuseVariableWhilePlanning(source: SceneObject, action: PlanningAction): boolean {
  const dashboard = findDashboardSceneFor(source);
  if (!dashboard || dashboard.isPlanningActionAllowed(action)) {
    return false;
  }

  dispatch(
    notifyApp(
      createErrorNotification(
        t(
          'dashboard-scene.refuse-variable-while-planning.message',
          'Cannot change variables while previewing a dashboard plan. Build or dismiss the plan first.'
        )
      )
    )
  );

  return true;
}
