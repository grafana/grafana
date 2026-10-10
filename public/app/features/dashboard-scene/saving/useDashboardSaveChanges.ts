import { debounce } from 'lodash';
import { useEffect, useReducer } from 'react';

import { SceneObjectStateChangedEvent } from '@grafana/scenes';

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
    return () => {
      actionsSubscription.unsubscribe();
      subscription.unsubscribe();
      invalidate.cancel();
    };
  }, [dashboard]);

  return dashboard.getDashboardChanges(saveTimeRange, saveVariables, saveRefresh);
}
