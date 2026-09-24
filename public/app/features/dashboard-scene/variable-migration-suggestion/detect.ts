import { type DataSourceApi } from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { QueryVariable, sceneGraph, type SceneDataQuery } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { type DashboardScene } from '../scene/DashboardScene';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

export type MigrationSuggestionConfidence = 'high' | 'low';

export interface MigrationSuggestionCandidateUsage {
  kind: 'filter' | 'groupBy';
  key?: string;
  operator?: string;
}

export interface MigrationSuggestionCandidate {
  variableName: string;
  datasourceUid: string;
  confidence: MigrationSuggestionConfidence;
  // Only populated for high-confidence candidates - low-confidence ones only justify showing
  // the CTA, the Assistant inspects the dashboard itself for the rest.
  usages: MigrationSuggestionCandidateUsage[];
}

interface QueryUsage {
  query: SceneDataQuery;
  datasourceUid: string | undefined;
}

/**
 * Enumerates every (variable, query) pair that could plausibly be a candidate for migration to
 * an ad hoc filter / group-by control, delegating the DS-specific classification to each
 * datasource's optional `getDrilldownMigrationUsage` capability where implemented, and falling
 * back to a broader, capability-only heuristic where it isn't.
 */
export async function detectDrilldownMigrationCandidates(
  scene: DashboardScene
): Promise<MigrationSuggestionCandidate[]> {
  const queryUsages = await getQueryUsages(scene);
  const candidates: MigrationSuggestionCandidate[] = [];

  for (const variable of sceneGraph.getVariables(scene).state.variables) {
    if (!(variable instanceof QueryVariable)) {
      continue;
    }

    const candidate = await detectCandidateForVariable(scene, variable, queryUsages);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

async function getQueryUsages(scene: DashboardScene): Promise<QueryUsage[]> {
  const usages: QueryUsage[] = [];

  for (const panel of dashboardSceneGraph.getVizPanels(scene)) {
    const queryRunner = getQueryRunnerFor(panel);
    if (!queryRunner) {
      continue;
    }

    for (const query of queryRunner.state.queries) {
      const ref = query.datasource ?? queryRunner.state.datasource;
      const settings = ref ? await getDataSourceInstanceSettings(ref) : undefined;
      usages.push({ query, datasourceUid: settings?.uid });
    }
  }

  return usages;
}

async function detectCandidateForVariable(
  scene: DashboardScene,
  variable: QueryVariable,
  queryUsages: QueryUsage[]
): Promise<MigrationSuggestionCandidate | undefined> {
  const variableDsRef = variable.state.datasource;
  if (!variableDsRef || isVariableTemplatedRef(variableDsRef)) {
    // A datasource-variable-templated ref (e.g. `${ds}`) can't be resolved reliably here.
    return undefined;
  }

  const instanceSettings = await getDataSourceInstanceSettings(variableDsRef);
  if (!instanceSettings) {
    return undefined;
  }

  let ds;
  try {
    ds = await getDataSourceInstance(variableDsRef);
  } catch {
    return undefined;
  }

  const supportsFilters = Boolean(ds.getTagKeys && ds.getTagValues);
  const supportsGroupBy = Boolean(ds.getGroupByKeys);
  if (!supportsFilters && !supportsGroupBy) {
    // Nothing to migrate to - this datasource doesn't support the target control at all.
    return undefined;
  }

  const pattern = variableReferencePattern(variable.state.name);

  const crossDatasourceUsage = queryUsages.some(
    (usage) => usage.datasourceUid !== instanceSettings.uid && matchesVariableReference(usage.query, pattern)
  );
  if (crossDatasourceUsage) {
    return undefined;
  }

  if (isReferencedOutsideQueries(scene, variable, pattern)) {
    return undefined;
  }

  const sameDatasourceQueries = queryUsages.filter((usage) => usage.datasourceUid === instanceSettings.uid);

  if (typeof ds.getDrilldownMigrationUsage === 'function') {
    return aggregateHighConfidenceCandidate(ds, variable, instanceSettings.uid, sameDatasourceQueries);
  }

  const isUsedInAQuery = sameDatasourceQueries.some((usage) => matchesVariableReference(usage.query, pattern));
  if (!isUsedInAQuery) {
    // Capability-only fallback still requires the variable to textually appear in a query -
    // otherwise a variable used only for a panel title/repeat would trigger the broad heuristic
    // on capability alone (see spec Spike S3).
    return undefined;
  }

  return {
    variableName: variable.state.name,
    datasourceUid: instanceSettings.uid,
    confidence: 'low',
    usages: [],
  };
}

function aggregateHighConfidenceCandidate(
  ds: DataSourceApi,
  variable: QueryVariable,
  datasourceUid: string,
  sameDatasourceQueries: QueryUsage[]
): MigrationSuggestionCandidate | undefined {
  const usages: MigrationSuggestionCandidateUsage[] = [];
  let filterKey: string | undefined;

  for (const { query } of sameDatasourceQueries) {
    const usage = ds.getDrilldownMigrationUsage!({ variableName: variable.state.name, query });
    if (!usage) {
      continue;
    }

    if (usage.kind === 'unsafe') {
      return undefined;
    }

    if (usage.kind === 'filter') {
      if (filterKey !== undefined && filterKey !== usage.key) {
        // Disagreeing filter keys across usages - ambiguous, can't seed one filter.
        return undefined;
      }
      filterKey = usage.key;
      usages.push({ kind: 'filter', key: usage.key, operator: usage.operator });
    } else {
      usages.push({ kind: 'groupBy' });
    }
  }

  if (usages.length === 0) {
    // The datasource never classified any usage of this variable - nothing to migrate.
    return undefined;
  }

  return { variableName: variable.state.name, datasourceUid, confidence: 'high', usages };
}

function isVariableTemplatedRef(ref: DataSourceRef): boolean {
  return typeof ref.uid === 'string' && ref.uid.includes('$');
}

function variableReferencePattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\$\\{?${escaped}\\b|\\[\\[${escaped}(?::[^\\]]+)?\\]\\]`);
}

function matchesVariableReference(value: unknown, pattern: RegExp): boolean {
  if (typeof value === 'string') {
    return pattern.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => matchesVariableReference(item, pattern));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => matchesVariableReference(item, pattern));
  }
  return false;
}

/**
 * The DS-agnostic part of the old (unmerged) detection's "referenced outside safe query
 * positions" rule: panel titles/descriptions, panel/row repeat, and other variables'
 * query/regex definitions. Implemented over the scene graph (not a save-model sweep) so it
 * works identically for v1- and v2-loaded dashboards without depending on either serializer.
 */
function isReferencedOutsideQueries(scene: DashboardScene, variable: QueryVariable, pattern: RegExp): boolean {
  for (const panel of dashboardSceneGraph.getVizPanels(scene)) {
    if (
      matchesVariableReference(panel.state.title, pattern) ||
      matchesVariableReference(panel.state.description, pattern)
    ) {
      return true;
    }
  }

  const repeatReferences = sceneGraph.findAllObjects(scene, (obj) =>
    hasVariableNameField(obj.state, variable.state.name)
  );
  if (repeatReferences.length > 0) {
    return true;
  }

  for (const other of sceneGraph.getVariables(scene).state.variables) {
    if (other !== variable && matchesVariableReference(other.state, pattern)) {
      return true;
    }
  }

  return false;
}

// Repeat behaviors (row/panel) key off the repeated variable's bare name (no `$` prefix),
// stored on a `variableName` field - unlike everything else here, this isn't a `pattern` match.
function hasVariableNameField(state: object, name: string): boolean {
  return Object.entries(state).some(([key, value]) => key === 'variableName' && value === name);
}
