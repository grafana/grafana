import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import {
  sceneGraph,
  SceneDataTransformer,
  SceneQueryRunner,
  VizPanel,
  type SceneObject,
} from '@grafana/scenes';
import { Alert } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

// Data sources whose queries are affected by scope filters.
const SCOPE_FILTERED_DATASOURCE_TYPES = ['loki', 'prometheus'];

// Mirrors the lookup in DownloadDashboardDiagnosticsRenderer: inlined here rather than imported
// to avoid reaching into that module's import graph for a two-line helper.
function getQueryRunnerFor(sceneObject: SceneObject | undefined): SceneQueryRunner | undefined {
  if (!sceneObject) {
    return undefined;
  }
  const dataProvider = sceneObject.state.$data ?? sceneObject.parent?.state.$data;
  if (dataProvider instanceof SceneQueryRunner) {
    return dataProvider;
  }
  if (dataProvider instanceof SceneDataTransformer) {
    return getQueryRunnerFor(dataProvider);
  }
  return undefined;
}

function hasScopeFilteredDatasource(dashboard: DashboardScene): boolean {
  const vizPanels = sceneGraph.findAllObjects(dashboard, (o) => o instanceof VizPanel);
  return vizPanels.some((obj) => {
    const runner = obj instanceof VizPanel ? getQueryRunnerFor(obj) : undefined;
    if (!runner) {
      return false;
    }
    const runnerType = runner.state.datasource?.type;
    if (runnerType && SCOPE_FILTERED_DATASOURCE_TYPES.includes(runnerType)) {
      return true;
    }
    return runner.state.queries.some(
      (query) => query.datasource?.type && SCOPE_FILTERED_DATASOURCE_TYPES.includes(query.datasource.type)
    );
  });
}

export function ScopeFiltersEditBanner({ dashboard }: { dashboard: DashboardScene }) {
  const { isEditing } = dashboard.useState();
  const scopes = useScopes();
  // Scopes without filters do not affect queries, so they are not a concern here.
  const hasScopeWithFilters = Boolean(scopes?.state.value.some((scope) => (scope.spec.filters?.length ?? 0) > 0));
  // Subscribing to the layout manager's state re-renders this banner when panels are added or
  // removed while already editing, not just when edit mode is first entered.
  dashboard.state.body.useState();

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!isEditing) {
      setDismissed(false);
    }
  }, [isEditing]);

  const shouldRender = Boolean(isEditing) && hasScopeWithFilters && hasScopeFilteredDatasource(dashboard);

  if (dismissed || !shouldRender) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title={t(
        'dashboard-scene.scope-filters-edit-banner.title',
        'Note: You are editing this dashboard with a Scope selected, which may affect your queries in unexpected ways. It is recommended that you review your selected Scope and select one without filters for editing.'
      )}
      onRemove={() => setDismissed(true)}
      style={{ flex: 0 }}
    />
  );
}
