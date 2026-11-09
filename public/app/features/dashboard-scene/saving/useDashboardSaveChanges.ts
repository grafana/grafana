import { debounce } from 'lodash';
import { useEffect, useMemo, useReducer } from 'react';

import { SceneObjectStateChangedEvent } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';
import { DashboardStateChangedEvent } from '../sidebar/events';

import { DashboardSceneChangeTracker } from './DashboardSceneChangeTracker';

/**
 * Keep comparisons current even when a second edit leaves isDirty unchanged. The result is the same object
 * until the dashboard or a save option changes, so consumers can key effects and memos on it.
 */
export function useDashboardSaveChanges(
  dashboard: DashboardScene,
  saveTimeRange?: boolean,
  saveVariables?: boolean,
  saveRefresh?: boolean
) {
  const [revision, refresh] = useReducer((current: number) => current + 1, 0);
  // Folder, uid and the JSON editor's model live on the scene's own state, which persisted-state events don't cover
  const { meta, uid, editview } = dashboard.useState();

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

  return useMemo(
    () => dashboard.getDashboardChanges(saveTimeRange, saveVariables, saveRefresh),
    // revision, meta, uid and editview aren't read here: they mark when the scene's save model may have changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard, revision, meta, uid, editview, saveTimeRange, saveVariables, saveRefresh]
  );
}
