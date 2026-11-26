import { debounce } from 'lodash';
import { useEffect, useReducer } from 'react';

import { SceneObjectStateChangedEvent } from '@grafana/scenes';

import { getPendingChangesHistory } from '../lifecycle/pendingChangePreview';
import { withNewDashboardBaseline } from '../lifecycle/pendingChangesSave';
import { type DashboardScene } from '../scene/DashboardScene';
import { DashboardStateChangedEvent } from '../sidebar/events';

import { DashboardSceneChangeTracker } from './DashboardSceneChangeTracker';

/** Keep comparisons current even when a second edit leaves isDirty unchanged. */
export function useDashboardSaveChanges(
  dashboard: DashboardScene,
  saveTimeRange?: boolean,
  saveVariables?: boolean,
  saveRefresh?: boolean
) {
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    const invalidate = debounce(refresh, 100);
    const subscription = dashboard.subscribeToEvent(SceneObjectStateChangedEvent, (event) => {
      if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
        invalidate();
      }
    });
    const actionsSubscription = dashboard.subscribeToEvent(DashboardStateChangedEvent, invalidate);
    // Pending changes compare as their plugin last recorded them, and a recording lands without a scene event.
    const unsubscribeHistory = getPendingChangesHistory(dashboard.state)?.subscribe(invalidate);
    return () => {
      unsubscribeHistory?.();
      actionsSubscription.unsubscribe();
      subscription.unsubscribe();
      invalidate.cancel();
    };
  }, [dashboard]);

  return withNewDashboardBaseline(dashboard, dashboard.getDashboardChanges(saveTimeRange, saveVariables, saveRefresh));
}
