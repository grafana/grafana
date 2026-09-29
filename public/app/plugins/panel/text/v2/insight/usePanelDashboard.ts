import { useEffect, useState } from 'react';

import { isDashboardSceneLike, type DashboardSceneLike } from 'app/features/dashboard-scene/scene/types/dashboard';

/**
 * PanelPlugin components receive PanelProps and have no SceneObject parent reference, so
 * window.__grafanaSceneContext is the only available handle on the dashboard. Subscribed to
 * so the panel re-renders when the layout changes and new source panels become selectable.
 */
export function usePanelDashboard(): DashboardSceneLike | undefined {
  const scene = window.__grafanaSceneContext;
  const dashboard = isDashboardSceneLike(scene) ? scene : undefined;
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!dashboard) {
      return;
    }
    const sub = dashboard.subscribeToState(() => setVersion((value) => value + 1));
    return () => sub.unsubscribe();
  }, [dashboard]);

  return dashboard;
}
