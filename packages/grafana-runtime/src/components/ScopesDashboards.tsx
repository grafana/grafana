import { getScopesDashboards } from '../services';

export function ScopesDashboards() {
  const scopesDashboardsScene = getScopesDashboards();

  if (!scopesDashboardsScene) {
    return null;
  }

  return <scopesDashboardsScene.Component model={scopesDashboardsScene} />;
}
