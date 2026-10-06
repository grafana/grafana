import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { Alert } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';
import { getDsRefsFromScene } from '../utils/dashboardDsRefs';

// Data sources whose queries are affected by scope filters.
const SCOPE_FILTERED_DATASOURCE_TYPES = ['loki', 'prometheus'];

function hasScopeFilteredDatasource(dashboard: DashboardScene): boolean {
  return getDsRefsFromScene(dashboard).some((ref) => ref.type && SCOPE_FILTERED_DATASOURCE_TYPES.includes(ref.type));
}

export function ScopeFiltersEditBanner({ dashboard }: { dashboard: DashboardScene }) {
  const { isEditing } = dashboard.useState();
  const scopes = useScopes();
  // Scopes without filters do not affect queries, so they are not a concern here.
  const hasScopeWithFilters = Boolean(scopes?.state.value.some((scope) => (scope.spec.filters?.length ?? 0) > 0));

  // The layout manager's own setState doesn't fire for a change deep in its subtree (grid
  // children, row/tab contents, a panel's query runner) — those call setState on the nested
  // object itself. SceneObjectStateChangedEvent bubbles from every descendant, so subscribing to
  // it here is what actually catches a panel being added/removed/changed while already editing.
  const body = dashboard.state.body;
  const [, forceRender] = useState(0);
  useEffect(() => {
    const sub = body.subscribeToEvent(SceneObjectStateChangedEvent, () => forceRender((n) => n + 1));
    return () => sub.unsubscribe();
  }, [body]);

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
