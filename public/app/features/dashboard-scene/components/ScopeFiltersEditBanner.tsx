import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import { SceneObjectStateChangedEvent, SceneQueryRunner, type SceneObject } from '@grafana/scenes';
import { Alert } from '@grafana/ui';
import { hasScopeFilteredDatasource } from 'app/features/scopes/dashboards/scopeFilteredDatasources';

import { type DashboardScene } from '../scene/DashboardScene';

// A SceneQueryRunner setState carrying only these keys is a data refresh (poll, panel in/out of
// view, etc.), not a change to what the query actually targets — ignoring it is what keeps a
// dashboard with N panels from re-walking the whole scene on every panel's every refresh tick.
const QUERY_RUNNER_DATA_ONLY_KEYS = new Set(['data', '_hasFetchedData']);

const RECOMPUTE_DEBOUNCE_MS = 150;

function isQueryRunnerDataOnlyUpdate(event: SceneObjectStateChangedEvent): boolean {
  return (
    event.payload.changedObject instanceof SceneQueryRunner &&
    Object.keys(event.payload.partialUpdate).every((key) => QUERY_RUNNER_DATA_ONLY_KEYS.has(key))
  );
}

export function ScopeFiltersEditBanner({ dashboard }: { dashboard: DashboardScene }) {
  const { isEditing } = dashboard.useState();
  const scopes = useScopes();
  // Scopes without filters do not affect queries, so they are not a concern here.
  const hasScopeWithFilters = Boolean(scopes?.state.value.some((scope) => (scope.spec.filters?.length ?? 0) > 0));

  const body: SceneObject = dashboard.state.body;
  const [hasFilteredDatasource, setHasFilteredDatasource] = useState(false);

  // The layout manager's own setState doesn't fire for a change deep in its subtree (grid
  // children, row/tab contents, a panel's query runner) — those call setState on the nested
  // object itself. SceneObjectStateChangedEvent bubbles from every descendant, so subscribing to
  // it here is what actually catches a panel being added/removed/changed while already editing.
  // Only relevant while editing (the banner can't show otherwise), and the scene is re-walked
  // only for structural changes, not every data refresh, so this stays cheap on a busy dashboard.
  useEffect(() => {
    if (!isEditing) {
      setHasFilteredDatasource(false);
      return;
    }

    // hasScopeFilteredDatasource resolves datasource refs asynchronously, so overlapping runs can
    // settle out of order. Only the latest run may write its result; `cancelled` also drops it
    // once this effect is torn down.
    let cancelled = false;
    let latestRun = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const recomputeHasFilteredDatasource = () => {
      const run = ++latestRun;
      hasScopeFilteredDatasource(dashboard)
        .then((result) => {
          if (!cancelled && run === latestRun) {
            setHasFilteredDatasource(result);
          }
        })
        .catch(() => {
          // A failed datasource lookup keeps the previous banner state rather than surfacing an error.
        });
    };

    recomputeHasFilteredDatasource();

    // Drag, resize and title edits emit bursts of state changes, so coalesce them into one walk.
    const sub = body.subscribeToEvent(SceneObjectStateChangedEvent, (event) => {
      if (!isQueryRunnerDataOnlyUpdate(event)) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(recomputeHasFilteredDatasource, RECOMPUTE_DEBOUNCE_MS);
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      sub.unsubscribe();
    };
  }, [dashboard, body, isEditing]);

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!isEditing) {
      setDismissed(false);
    }
  }, [isEditing]);

  const shouldRender = Boolean(isEditing) && hasScopeWithFilters && hasFilteredDatasource;

  if (dismissed || !shouldRender) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title={t(
        'dashboard-scene.scope-filters-edit-banner.title',
        'You are editing this dashboard with a Scope selected'
      )}
      onRemove={() => setDismissed(true)}
      style={{ flex: 0 }}
      data-testid="scope-filters-edit-banner"
    >
      {t(
        'dashboard-scene.scope-filters-edit-banner.body',
        'This may affect your queries in unexpected ways. It is recommended that you review your selected Scope and select one without filters for editing.'
      )}
    </Alert>
  );
}
