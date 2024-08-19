import { scopesDashboardsScene } from './instance';

export function ScopesDashboards() {
  if (!scopesDashboardsScene) {
    return null;
  }

  return <scopesDashboardsScene.Component model={scopesDashboardsScene} />;
}
