import { getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GROUP_BY_OPERATOR,
  QueryVariable,
  sceneGraph,
  type AdHocFilterWithLabels,
  type SceneVariables,
  type VariableValue,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { type DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { getNextAvailableId, getVariableNamePrefix, getVariableScene } from '../settings/variables/utils';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../utils/utils';

import { type MigrationCandidate } from './detect';
import { removeVariableUsagesFromExpr, textReferencesVariable } from './promqlVariableUsage';

export interface AppliedVariableMigration {
  migratedVariableNames: string[];
  adHocVariables: AdHocFiltersVariable[];
}

/**
 * Migrates the selected (non-disqualified) candidates to the unified drilldown control:
 * one AdHocFiltersVariable per Prometheus datasource (reused when one already exists),
 * seeded from the variables' current values so panels keep rendering the same data;
 * panel query exprs are stripped of the migrated interpolations (the control re-injects
 * filters client-side and groupBy server-side at query time); the migrated query
 * variables are removed. Only mutates the runtime scene — never saves: the change
 * tracker marks the dashboard dirty and the user persists or discards explicitly.
 */
export function applyVariableMigration(
  dashboard: DashboardScene,
  candidates: MigrationCandidate[]
): AppliedVariableMigration {
  const selected = candidates.filter(
    (candidate) => !candidate.disqualified && candidate.kind !== undefined && candidate.datasourceUid !== undefined
  );

  if (selected.length === 0) {
    return { migratedVariableNames: [], adHocVariables: [] };
  }

  if (!dashboard.state.isEditing) {
    dashboard.onEnterEditMode();
  }

  const variableSet = sceneGraph.getVariables(dashboard);

  const byDatasourceUid = new Map<string, MigrationCandidate[]>();
  for (const candidate of selected) {
    const dsUid = candidate.datasourceUid!;
    byDatasourceUid.set(dsUid, [...(byDatasourceUid.get(dsUid) ?? []), candidate]);
  }

  const adHocVariables: AdHocFiltersVariable[] = [];

  for (const [dsUid, dsCandidates] of byDatasourceUid) {
    const newFilters: AdHocFilterWithLabels[] = [];
    let enableGroupBy = false;

    for (const candidate of dsCandidates) {
      if (candidate.kind === 'filter' || candidate.kind === 'both') {
        const seed = buildFilterSeed(candidate);
        if (seed) {
          newFilters.push(seed);
        }
      }
      if (candidate.kind === 'groupBy' || candidate.kind === 'both') {
        enableGroupBy = true;
        newFilters.push(...buildGroupBySeeds(candidate));
      }
    }

    const adHocVariable =
      findAdHocVariableForDatasource(variableSet, dsUid) ??
      createAdHocVariable(variableSet, dsUid, dsCandidates[0].datasourceRef);

    adHocVariable.setState({
      filters: [...adHocVariable.state.filters, ...newFilters],
      ...(enableGroupBy ? { enableGroupBy: true } : {}),
    });

    adHocVariables.push(adHocVariable);
  }

  rewritePanelQueries(dashboard, byDatasourceUid);

  const migratedNames = new Set(selected.map((candidate) => candidate.variableName));
  variableSet.setState({
    variables: variableSet.state.variables.filter(
      (variable) => !(variable instanceof QueryVariable && migratedNames.has(variable.state.name))
    ),
  });

  return { migratedVariableNames: [...migratedNames], adHocVariables };
}

/**
 * Seeds a filter entry from the variable's current value so the panels render the same
 * data before and after the migration. All (`$__all`) and empty values seed nothing —
 * the absence of a filter matches everything.
 */
function buildFilterSeed(candidate: MigrationCandidate): AdHocFilterWithLabels | undefined {
  const key = candidate.filterKey;
  if (!key) {
    return undefined;
  }

  const values = normalizeCurrentValues(candidate.currentValue);
  if (values.length === 0) {
    return undefined;
  }

  if (values.length > 1) {
    return {
      key,
      operator: '=|',
      value: values[0],
      values: [...values],
      valueLabels: [...values],
    };
  }

  // Values interpolated under a regex matcher stay regexes; the one-of/equality remap in
  // the Prometheus datasource handles escaping for plain values.
  const operator = candidate.filterOperators.includes('=~') ? '=~' : '=';
  return { key, operator, value: values[0] };
}

function buildGroupBySeeds(candidate: MigrationCandidate): AdHocFilterWithLabels[] {
  // Shape of toGroupByFilter in serialization/groupByMigration.ts
  return normalizeCurrentValues(candidate.currentValue).map((labelName) => ({
    key: labelName,
    operator: GROUP_BY_OPERATOR,
    value: '',
    condition: '',
  }));
}

function normalizeCurrentValues(value: VariableValue | null | undefined): string[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  const values = raw.map(String).filter((entry) => entry !== '');
  return values.includes(ALL_VARIABLE_VALUE) ? [] : values;
}

function findAdHocVariableForDatasource(variableSet: SceneVariables, dsUid: string): AdHocFiltersVariable | undefined {
  for (const variable of variableSet.state.variables) {
    if (variable instanceof AdHocFiltersVariable && resolveDatasourceUid(variable.state.datasource) === dsUid) {
      return variable;
    }
  }
  return undefined;
}

function createAdHocVariable(
  variableSet: SceneVariables,
  dsUid: string,
  candidateDsRef: DataSourceRef | null
): AdHocFiltersVariable {
  const name = getNextAvailableId(getVariableNamePrefix('adhoc'), variableSet.state.variables);
  const variable = getVariableScene('adhoc', { name });

  if (!(variable instanceof AdHocFiltersVariable)) {
    throw new Error('expected an AdHocFiltersVariable');
  }

  // A null candidate ref means the default datasource; pin the resolved uid so the
  // control keeps targeting the same datasource even if the default changes.
  const datasource = candidateDsRef ?? { type: 'prometheus', uid: dsUid };

  variable.setState({
    datasource,
    applyMode: 'auto',
    useQueriesAsFilterForOptions: true,
    supportsMultiValueOperators: Boolean(
      getDataSourceSrv().getInstanceSettings(datasource)?.meta?.multiValueFilterOperators
    ),
  });

  variableSet.setState({ variables: [...variableSet.state.variables, variable] });

  return variable;
}

function rewritePanelQueries(dashboard: DashboardScene, candidatesByDsUid: Map<string, MigrationCandidate[]>) {
  for (const panel of dashboardSceneGraph.getVizPanels(dashboard)) {
    if (panel.state.$behaviors?.some((behavior) => behavior instanceof LibraryPanelBehavior)) {
      // Library panel content is shared; detection disqualifies variables used there.
      continue;
    }

    const queryRunner = getQueryRunnerFor(panel);
    if (!queryRunner) {
      continue;
    }

    let changed = false;
    const queries = queryRunner.state.queries.map((query) => {
      const expr: unknown = query.expr;
      if (typeof expr !== 'string') {
        return query;
      }

      const dsUid = resolveDatasourceUid(query.datasource ?? queryRunner.state.datasource ?? null);
      if (dsUid === undefined) {
        return query;
      }

      const variableNames = (candidatesByDsUid.get(dsUid) ?? [])
        .map((candidate) => candidate.variableName)
        .filter((name) => textReferencesVariable(expr, name));

      if (variableNames.length === 0) {
        return query;
      }

      const rewrittenExpr = removeVariableUsagesFromExpr(expr, variableNames);
      if (rewrittenExpr === undefined) {
        // Detection guarantees rewritable usages; leave the query untouched if not.
        console.warn('variable-migration: could not rewrite expr', { refId: query.refId, expr });
        return query;
      }
      if (rewrittenExpr === expr) {
        return query;
      }

      changed = true;
      return { ...query, expr: rewrittenExpr };
    });

    if (changed) {
      queryRunner.setState({ queries });
      if (queryRunner.isActive) {
        queryRunner.runQueries();
      }
    }
  }
}

function resolveDatasourceUid(ref: DataSourceRef | string | null): string | undefined {
  const uidOrName = typeof ref === 'string' ? ref : ref?.uid;
  if (typeof uidOrName === 'string' && uidOrName.includes('$')) {
    return undefined;
  }
  return getDataSourceSrv().getInstanceSettings(ref)?.uid;
}
