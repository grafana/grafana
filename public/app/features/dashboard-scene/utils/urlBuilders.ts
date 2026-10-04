import { type AdHocVariableFilter, type DataQuery, type DataSourceInstanceSettings, locationUtil } from '@grafana/data';
import { getTemplateSrv as getRuntimeTemplateSrv, locationService } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import {
  AdHocFiltersVariable,
  sceneGraph,
  type SceneObject,
  type SceneQueryRunner,
  type SceneVariable,
  type SceneVariableSet,
  type VizPanel,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { getTemplateSrv } from 'app/features/templating/template_srv';

import { getDatasourceFromQueryRunner } from './getDatasourceFromQueryRunner';
import { getQueryRunnerFor } from './getQueryRunnerFor';

export function getEditPanelUrl(panelId: number) {
  return locationUtil.getUrlForPartial(locationService.getLocation(), { editPanel: panelId, viewPanel: undefined });
}

export async function tryGetExploreUrlForPanel(vizPanel: VizPanel): Promise<string | undefined> {
  const panelPlugin = vizPanel.getPlugin();
  const queryRunner = getQueryRunnerFor(vizPanel);

  if (!contextSrv.hasAccessToExplore() || panelPlugin?.meta.skipDataQuery || !queryRunner) {
    return undefined;
  }

  const timeRange = sceneGraph.getTimeRange(vizPanel);
  const datasource = getDatasourceFromQueryRunner(queryRunner);
  const queries = queryRunner.state.queries ?? [];

  if (isMixedDatasource(datasource) || hasMixedQueries(queries)) {
    const interpolatedQueries = await Promise.all(
      queries.map(async (query) => {
        if (query.datasource?.uid === ExpressionDatasourceUID) {
          return query;
        }
        const queryDsRef = query.datasource ?? (isMixedDatasource(datasource) ? { uid: 'default' } : datasource);
        const queryFilters = await getAdhocFiltersForPanel(vizPanel, queryRunner, queryDsRef);
        if (!queryFilters || queryFilters.length === 0) {
          return query;
        }
        try {
          const dsInstance = await getDataSourceInstance(queryDsRef);
          if (dsInstance?.interpolateVariablesInQueries) {
            const interpolated = dsInstance.interpolateVariablesInQueries(
              [query],
              { __sceneObject: { value: vizPanel } },
              queryFilters
            );
            return interpolated?.[0] || query;
          }
        } catch {}
        return query;
      })
    );

    return getExploreUrl({
      queries: interpolatedQueries,
      dsRef: datasource,
      timeRange: timeRange.state.value,
      scopedVars: { __sceneObject: { value: vizPanel } },
      adhocFilters: undefined,
    });
  }

  const adhocFilters = await getAdhocFiltersForPanel(vizPanel, queryRunner, datasource);

  return getExploreUrl({
    queries,
    dsRef: datasource,
    timeRange: timeRange.state.value,
    scopedVars: { __sceneObject: { value: vizPanel } },
    adhocFilters,
  });
}

export async function getAdhocFiltersForPanel(
  vizPanel: VizPanel,
  queryRunner: SceneQueryRunner,
  datasource?: DataSourceRef | null
): Promise<AdHocVariableFilter[] | undefined> {
  const isMixedPanel =
    isMixedDatasource(queryRunner.state.datasource) || hasMixedQueries(queryRunner.state.queries);
  const isSpecificDatasourceOnMixedPanel = isMixedPanel && datasource != null && !isMixedDatasource(datasource);

  // 1. If the query runner has already executed a request with filters, sanitize and use them.
  // Note: Only use on non-mixed panels or when querying overall mixed panel to prevent cross-datasource leakage.
  if (!isSpecificDatasourceOnMixedPanel) {
    const requestFilters = queryRunner.state.data?.request?.filters;
    if (requestFilters && requestFilters.length > 0) {
      const valid = requestFilters.filter(isFilterApplicableAndComplete);
      if (valid.length > 0) {
        return valid;
      }
    }

    // 2. If the query runner's drilldown dependencies manager has active filters, sanitize and use them.
    if (hasDrilldownManager(queryRunner)) {
      const drilldownFilters = queryRunner._drilldownDependenciesManager.getFilters?.();
      if (drilldownFilters && drilldownFilters.length > 0) {
        const valid = drilldownFilters.filter(isFilterApplicableAndComplete);
        if (valid.length > 0) {
          return valid;
        }
      }
    }
  }

  // 3. Look up active AdHocFiltersVariable instances from the scene hierarchy.
  const { filters: hierarchyFilters, hasMatchingVariables } = await getAdhocFiltersFromSceneHierarchy(
    vizPanel,
    queryRunner,
    datasource
  );
  if (hierarchyFilters && hierarchyFilters.length > 0) {
    return hierarchyFilters;
  }

  // 4. Fallback to templateSrv for legacy dashboard / unmapped cases.
  // If the scene hierarchy already contains matching AdHoc variables (e.g. in manual applyMode),
  // do not fall back to templateSrv which patches getAdhocFilters globally and would leak manual filters.
  if (!hasMatchingVariables) {
    const targetDatasources = getDatasourceRefsForPanel(queryRunner, datasource);
    const templateSrvFilters = await getAdhocFiltersFromTemplateSrv(targetDatasources);
    if (templateSrvFilters && templateSrvFilters.length > 0) {
      return templateSrvFilters;
    }
  }

  return undefined;
}

interface DrilldownAwareRunner {
  _drilldownDependenciesManager: {
    getFilters?: () => AdHocVariableFilter[] | undefined;
  };
}

function hasDrilldownManager(runner: unknown): runner is DrilldownAwareRunner {
  if (typeof runner !== 'object' || runner === null || !('_drilldownDependenciesManager' in runner)) {
    return false;
  }
  const manager = runner._drilldownDependenciesManager;
  return typeof manager === 'object' && manager !== null;
}

interface LegacyTemplateSrv {
  getAdhocFilters?: (ds: string, skip?: boolean) => AdHocVariableFilter[];
}

function isLegacyTemplateSrv(
  srv: unknown
): srv is LegacyTemplateSrv & { getAdhocFilters: (ds: string, skip?: boolean) => AdHocVariableFilter[] } {
  return (
    typeof srv === 'object' &&
    srv !== null &&
    'getAdhocFilters' in srv &&
    typeof srv.getAdhocFilters === 'function'
  );
}

function getSafeTemplateSrv():
  | (LegacyTemplateSrv & { getAdhocFilters: (ds: string, skip?: boolean) => AdHocVariableFilter[] })
  | undefined {
  try {
    const runtimeSrv: unknown = getRuntimeTemplateSrv();
    if (isLegacyTemplateSrv(runtimeSrv)) {
      return runtimeSrv;
    }
  } catch {}
  try {
    const srv: unknown = getTemplateSrv();
    if (isLegacyTemplateSrv(srv)) {
      return srv;
    }
  } catch {}
  return undefined;
}

function isMixedDatasource(ds?: DataSourceRef | null): boolean {
  if (!ds) {
    return false;
  }
  return ds.type === 'mixed' || ds.uid === '-- Mixed --' || (typeof ds === 'string' && ds === '-- Mixed --');
}

function hasMixedQueries(queries?: DataQuery[]): boolean {
  if (!queries || queries.length <= 1) {
    return false;
  }
  const nonExpression = queries.filter((q) => q.datasource?.uid !== ExpressionDatasourceUID && q.datasource != null);
  if (nonExpression.length <= 1) {
    return false;
  }
  const first = nonExpression[0].datasource;
  const firstUid = typeof first === 'string' ? first : first?.uid;
  const firstType = typeof first === 'object' ? first?.type : undefined;

  for (let i = 1; i < nonExpression.length; i++) {
    const cur = nonExpression[i].datasource;
    const curUid = typeof cur === 'string' ? cur : cur?.uid;
    const curType = typeof cur === 'object' ? cur?.type : undefined;
    if (firstUid !== curUid || firstType !== curType) {
      return true;
    }
  }
  return false;
}

function getDatasourceRefsForPanel(
  queryRunner: SceneQueryRunner,
  primaryDs?: DataSourceRef | null
): Array<DataSourceRef | null | undefined> {
  // If a specific, non-mixed datasource was requested, only match against that datasource
  if (primaryDs && !isMixedDatasource(primaryDs)) {
    return [primaryDs];
  }

  const refs: Array<DataSourceRef | null | undefined> = [];
  const seenKeys = new Set<string>();

  const addRef = (ref?: DataSourceRef | null) => {
    if (ref && !isMixedDatasource(ref)) {
      const key = `${typeof ref === 'string' ? ref : ref.uid ?? ''}:${typeof ref === 'object' ? ref.type ?? '' : ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        refs.push(ref);
      }
    }
  };

  addRef(queryRunner.state.datasource);

  for (const query of queryRunner.state.queries ?? []) {
    if (query.datasource && query.datasource.uid !== ExpressionDatasourceUID) {
      addRef(query.datasource);
    }
  }

  if (refs.length === 0) {
    refs.push(primaryDs);
  }

  return refs;
}

async function getAdhocFiltersFromSceneHierarchy(
  vizPanel: VizPanel,
  queryRunner?: SceneQueryRunner,
  primaryDatasource?: DataSourceRef | null
): Promise<{ filters: AdHocVariableFilter[]; hasMatchingVariables: boolean }> {
  const targetDatasources = queryRunner
    ? getDatasourceRefsForPanel(queryRunner, primaryDatasource)
    : [primaryDatasource];

  const variableSets: SceneVariableSet[] = [];

  // Check closest variable set via sceneGraph.getVariables first for nearest-scope shadowing
  const closestSet = sceneGraph.getVariables(vizPanel);
  if (closestSet) {
    variableSets.push(closestSet);
  }

  // Walk up parents from vizPanel (closest-to-farthest for nearest-scope shadowing)
  let current: SceneObject | undefined = vizPanel;
  while (current) {
    if (current.state.$variables && !variableSets.includes(current.state.$variables)) {
      variableSets.push(current.state.$variables);
    }
    current = current.parent;
  }

  const adhocVars: AdHocFiltersVariable[] = [];
  const seenVars = new Set<SceneVariable>();
  const seenVarNames = new Set<string>();

  for (const set of variableSets) {
    for (const variable of set.state.variables) {
      if (!seenVars.has(variable) && isAdhocVar(variable)) {
        seenVars.add(variable);
        const name = variable.state.name;
        if (name) {
          if (seenVarNames.has(name)) {
            // Shadowed by an inner/closer scope variable with the same name
            continue;
          }
          seenVarNames.add(name);
        }
        adhocVars.push(variable);
      }
    }
  }

  const collectedFilters: AdHocVariableFilter[] = [];
  const seenFilterKeys = new Set<string>();
  let hasMatchingVariables = false;

  for (const variable of adhocVars) {
    let matches = false;
    for (const ds of targetDatasources) {
      if (await doesVariableMatchDatasource(vizPanel, variable, ds)) {
        matches = true;
        break;
      }
    }
    if (!matches) {
      continue;
    }

    hasMatchingVariables = true;

    if (variable.state.applyMode === 'manual') {
      continue;
    }

    const varFilters = [
      ...(variable.state.originFilters ?? []),
      ...(variable.state.filters ?? []),
    ];

    for (const filter of varFilters) {
      if (!isFilterApplicableAndComplete(filter)) {
        continue;
      }
      const key = getFilterIdentityKey(filter);
      if (seenFilterKeys.has(key)) {
        continue;
      }
      seenFilterKeys.add(key);
      collectedFilters.push(filter);
    }
  }

  return { filters: collectedFilters, hasMatchingVariables };
}

function isAdhocVar(variable: SceneVariable): variable is AdHocFiltersVariable {
  return variable instanceof AdHocFiltersVariable || variable.state.type === 'adhoc';
}

async function doesVariableMatchDatasource(
  interpolateContext: SceneObject,
  variable: AdHocFiltersVariable,
  datasource: DataSourceRef | null | undefined
): Promise<boolean> {
  const varDs = variable.state.datasource;
  const rawVarUid = typeof varDs === 'string' ? varDs : varDs?.uid;
  const varDsUid = sceneGraph.interpolate(variable, rawVarUid);

  const rawTargetUid = typeof datasource === 'string' ? datasource : datasource?.uid;
  const targetDsUid = sceneGraph.interpolate(interpolateContext, rawTargetUid);

  // 1. Direct UID match (interpolated or raw)
  if (varDsUid && targetDsUid && varDsUid === targetDsUid) {
    return true;
  }
  if (rawVarUid && rawTargetUid && rawVarUid === rawTargetUid) {
    return true;
  }

  let targetDsSettings: DataSourceInstanceSettings | undefined;
  try {
    targetDsSettings = await getDataSourceInstanceSettings(targetDsUid || datasource || null);
  } catch {
    targetDsSettings = undefined;
  }

  let varDsSettings: DataSourceInstanceSettings | undefined;
  try {
    varDsSettings = await getDataSourceInstanceSettings(varDsUid || varDs || null);
  } catch {
    varDsSettings = undefined;
  }

  // Determine resolved types
  const targetType = (typeof datasource === 'object' ? datasource?.type : undefined) ?? targetDsSettings?.type;
  const varType = (typeof varDs === 'object' ? varDs?.type : undefined) ?? varDsSettings?.type;

  // Incompatible types can never match
  if (targetType && varType && targetType !== varType) {
    return false;
  }

  // 2. Direct match against resolved settings UID if both resolved
  if (varDsSettings?.uid && targetDsSettings?.uid) {
    return varDsSettings.uid === targetDsSettings.uid;
  }

  // If one resolved and matches raw/interpolated UID of the other
  if (varDsSettings?.uid && (targetDsUid === varDsSettings.uid || rawTargetUid === varDsSettings.uid)) {
    return true;
  }
  if (targetDsSettings?.uid && (varDsUid === targetDsSettings.uid || rawVarUid === targetDsSettings.uid)) {
    return true;
  }

  // 3. Both refer to default datasource
  const isExplicitNonDefaultRef = (ref?: DataSourceRef | null, settings?: DataSourceInstanceSettings) => {
    if (settings != null) {
      return !settings.isDefault;
    }
    if (typeof ref === 'string') {
      return ref !== 'default';
    }
    if (typeof ref === 'object' && ref !== null) {
      if (ref.uid && ref.uid !== 'default') {
        return true;
      }
      if (ref.type && !ref.uid) {
        return true;
      }
    }
    return false;
  };

  const isTargetDefault =
    targetDsSettings != null
      ? targetDsSettings.isDefault === true
      : !isExplicitNonDefaultRef(datasource, targetDsSettings);

  const isVarDefault =
    varDsSettings != null
      ? varDsSettings.isDefault === true
      : !isExplicitNonDefaultRef(varDs, varDsSettings);

  if (isTargetDefault && isVarDefault) {
    return true;
  }

  // 4. Type match when at least one datasource has no UID specified (type-only reference)
  if (targetType && varType && targetType === varType) {
    const targetHasNoUid = !targetDsUid && !rawTargetUid && !targetDsSettings?.uid;
    const varHasNoUid = !varDsUid && !rawVarUid && !varDsSettings?.uid;
    if (targetHasNoUid || varHasNoUid) {
      return true;
    }
  }

  return false;
}

interface ExtendedFilter extends AdHocVariableFilter {
  nonApplicable?: boolean;
}

function isFilterApplicableAndComplete(filter: AdHocVariableFilter): boolean {
  if (!filter.key || !filter.operator) {
    return false;
  }
  if (filter.operator === 'groupBy') {
    return false;
  }
  if (filter.value == null || filter.value === '') {
    if (!filter.values || filter.values.length === 0) {
      return false;
    }
  }
  const extendedFilter: ExtendedFilter = filter;
  if (extendedFilter.nonApplicable) {
    return false;
  }
  if (filter.operator === '=|') {
    const values = filter.values ?? (filter.value ? [filter.value] : []);
    if (values.includes('__all__')) {
      return false;
    }
  }
  if (filter.operator === '=~') {
    if (filter.value === '.*' || (filter.values && filter.values.includes('.*'))) {
      return false;
    }
  }

  return true;
}

function getFilterIdentityKey(filter: AdHocVariableFilter): string {
  const values = filter.values?.join(',') ?? filter.value ?? '';
  return `${filter.origin ?? ''}|${filter.key}|${filter.operator}|${values}`;
}

async function getAdhocFiltersFromTemplateSrv(
  targetDatasources: Array<DataSourceRef | null | undefined>
): Promise<AdHocVariableFilter[] | undefined> {
  const templateSrv = getSafeTemplateSrv();
  if (!templateSrv?.getAdhocFilters) {
    return undefined;
  }

  const collected: AdHocVariableFilter[] = [];
  const seenKeys = new Set<string>();

  for (const datasource of targetDatasources) {
    try {
      const rawUid = typeof datasource === 'string' ? datasource : datasource?.uid;
      let dsSettings: DataSourceInstanceSettings | undefined;
      try {
        dsSettings = await getDataSourceInstanceSettings(rawUid || datasource || null);
      } catch {
        dsSettings = undefined;
      }

      const candidateKeys = [rawUid, dsSettings?.name, dsSettings?.uid].filter(
        (k): k is string => typeof k === 'string' && k.length > 0
      );
      if (candidateKeys.length === 0) {
        candidateKeys.push('');
      }

      for (const key of candidateKeys) {
        const filters = templateSrv.getAdhocFilters(key, true);
        if (filters && filters.length > 0) {
          for (const f of filters) {
            if (isFilterApplicableAndComplete(f)) {
              const id = getFilterIdentityKey(f);
              if (!seenKeys.has(id)) {
                seenKeys.add(id);
                collected.push(f);
              }
            }
          }
          break;
        }
      }
    } catch {}
  }

  return collected.length > 0 ? collected : undefined;
}
