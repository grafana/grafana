import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { type DataSourceApi, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  sceneGraph,
  SceneQueryRunner,
  sceneUtils,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { Button, useStyles2 } from '@grafana/ui';

import { getNextAvailableId } from '../settings/variables/utils';
import { dashboardEditActions } from '../sidebar/shared';
import { DashboardInteractions } from '../utils/interactions';

import { type DashboardScene } from './DashboardScene';

interface FilterCapability {
  /** Org gate: at least one configured datasource supports ad hoc filters */
  orgHasCapableDs: boolean;
  /** Dashboard gate: a datasource used by a panel query on this dashboard supports ad hoc filters */
  dashboardUsesCapableDs: boolean;
  /** No panels yet, so nothing to infer relevance from */
  isEmptyDashboard: boolean;
  /** Best datasource to preselect: in-use capable one first, else first capable in the org */
  preferredDsRef?: DataSourceRef;
}

async function getDsIfFilterCapable(uid: string | undefined): Promise<DataSourceApi | undefined> {
  try {
    const ds = await getDataSourceSrv().get(uid);
    return ds.getTagKeys ? ds : undefined;
  } catch {
    return undefined;
  }
}

const NO_CAPABILITY: FilterCapability = {
  orgHasCapableDs: false,
  dashboardUsesCapableDs: false,
  isEmptyDashboard: false,
};

// Sync pre-check: with no datasource service (test environments) or no configured
// datasources, the org gate is closed and no async probe should be scheduled
function hasDataSourcesToProbe(): boolean {
  try {
    const list = getDataSourceSrv()?.getList?.({ mixed: false });
    return Array.isArray(list) && list.length > 0;
  } catch {
    return false;
  }
}

// Prototype note: loading datasource instances to probe for getTagKeys is fine locally,
// but a real implementation should expose filter support on DataSourceInstanceSettings
// so this becomes a sync check over getList().
async function detectFilterCapability(dashboard: DashboardScene): Promise<FilterCapability> {
  try {
    return await detectFilterCapabilityInner(dashboard);
  } catch {
    // No datasource service (e.g. test environments) or probe failure: fail closed,
    // the button simply doesn't render
    return NO_CAPABILITY;
  }
}

async function detectFilterCapabilityInner(dashboard: DashboardScene): Promise<FilterCapability> {
  const isEmptyDashboard = sceneGraph.findAllObjects(dashboard, (o) => o instanceof VizPanel).length === 0;

  // Datasources referenced by panel queries; undefined uid means the default datasource
  const inUseUids = new Set<string | undefined>();
  for (const obj of sceneGraph.findAllObjects(dashboard, (o) => o instanceof SceneQueryRunner)) {
    if (obj instanceof SceneQueryRunner) {
      inUseUids.add(obj.state.datasource?.uid);
    }
  }

  let preferred: DataSourceApi | undefined;
  for (const uid of inUseUids) {
    preferred = await getDsIfFilterCapable(uid);
    if (preferred) {
      break;
    }
  }
  const dashboardUsesCapableDs = Boolean(preferred);

  let orgHasCapableDs = dashboardUsesCapableDs;
  if (!orgHasCapableDs) {
    for (const setting of getDataSourceSrv().getList({ mixed: false })) {
      const ds = await getDsIfFilterCapable(setting.uid);
      if (ds) {
        orgHasCapableDs = true;
        preferred = ds;
        break;
      }
    }
  }

  return { orgHasCapableDs, dashboardUsesCapableDs, isEmptyDashboard, preferredDsRef: preferred?.getRef() };
}

export function AddFilterButton({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const { editview, editPanel, isEditing, viewPanel } = dashboard.useState();
  const { variables } = sceneGraph.getVariables(dashboard).useState();
  const [capability, setCapability] = useState<FilterCapability | null>(() =>
    hasDataSourcesToProbe() ? null : NO_CAPABILITY
  );

  useEffect(() => {
    if (!hasDataSourcesToProbe()) {
      return;
    }
    let cancelled = false;
    detectFilterCapability(dashboard).then(
      (c) => {
        if (!cancelled) {
          setCapability(c);
        }
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [dashboard]);

  const hasFilters = variables.some((v) => sceneUtils.isAdHocVariable(v));

  const handleClick = useCallback(() => {
    const existing = dashboard.state.$variables;
    const variablesSet = existing instanceof SceneVariableSet ? existing : new SceneVariableSet({ variables: [] });

    if (!existing) {
      dashboard.setState({ $variables: variablesSet });
    }

    const newVar = new AdHocFiltersVariable({
      name: getNextAvailableId('filter', variablesSet.state.variables ?? []),
      datasource: capability?.preferredDsRef ?? null,
      filters: [],
      enableGroupBy: true,
    });

    dashboardEditActions.addVariable({ source: variablesSet, addedObject: newVar });
    dashboard.state.sidebar.selectObject(newVar);
    DashboardInteractions.addVariableButtonClicked({ source: 'filter_controls' });
  }, [dashboard, capability]);

  // Same visibility guards as AddVariableButton
  if (!isEditing || !!editview || !!viewPanel || !!editPanel) {
    return null;
  }

  // Org gate: never show a button that can only dead-end (also hides while capability loads)
  if (!capability?.orgHasCapableDs) {
    return null;
  }

  // Prominence: full label until this dashboard has its first filter, and only when
  // the dashboard is relevant (uses a capable datasource) or empty (nothing to infer from)
  const showLabel = !hasFilters && (capability.isEmptyDashboard || capability.dashboardUsesCapableDs);

  return (
    <div className={styles.addButton}>
      <div className="dashboard-canvas-add-button">
        <Button
          icon="filter"
          variant="secondary"
          fill="outline"
          size="md"
          onClick={handleClick}
          tooltip={showLabel ? undefined : t('dashboard-scene.filter-controls.add-filter', 'Add filter')}
          aria-label={t('dashboard-scene.filter-controls.add-filter', 'Add filter')}
        >
          {showLabel ? t('dashboard-scene.filter-controls.filter', 'Filter') : undefined}
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  addButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});
