import { type DataSourceApi } from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { QueryVariable, SceneDataTransformer, sceneGraph, type SceneDataQuery } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
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
  // Filter candidates also used in titles, links, text, etc. - the Assistant has to rewrite those
  // references to `${filters["<key>"]}` when it migrates the variable.
  referencedOutsideQueries?: boolean;
}

// Where a variable is referenced outside panel queries. `display` references (titles, links,
// text, ...) are interpolated on the frontend, where a filter's value is reachable through
// `${filters["<key>"]}`; `blocking` ones (annotations, repeats, other variables) have no
// equivalent once the variable is gone.
type OutsideQueryReferences = 'none' | 'display' | 'blocking';

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
      // No ref at either level means the default datasource, which the lookup resolves.
      const ref = query.datasource ?? queryRunner.state.datasource;
      const settings = await getDataSourceInstanceSettings(ref);
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
  // A missing ref means the default datasource, which the lookups below resolve.
  const variableDsRef = variable.state.datasource;
  if (variableDsRef && isVariableTemplatedRef(variableDsRef)) {
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

  const outsideQueryReferences = getOutsideQueryReferences(scene, variable, pattern);
  if (outsideQueryReferences === 'blocking') {
    return undefined;
  }

  const sameDatasourceQueries = queryUsages.filter((usage) => usage.datasourceUid === instanceSettings.uid);

  if (typeof ds.getDrilldownMigrationUsage === 'function') {
    const candidate = aggregateHighConfidenceCandidate(ds, variable, instanceSettings.uid, sameDatasourceQueries);
    if (!candidate || outsideQueryReferences === 'none') {
      return candidate;
    }
    // Only a filter's value can be interpolated per key; a group-by has no such equivalent.
    if (!candidate.usages.every((usage) => usage.kind === 'filter')) {
      return undefined;
    }
    return { ...candidate, referencedOutsideQueries: true };
  }

  if (outsideQueryReferences === 'display') {
    // Without the datasource's classification there's no telling whether the variable becomes a
    // filter, so whether its display references can be rewritten at all.
    return undefined;
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
  let kind: MigrationSuggestionCandidateUsage['kind'] | undefined;

  for (const { query } of sameDatasourceQueries) {
    const usage = ds.getDrilldownMigrationUsage!({ variableName: variable.state.name, query });
    if (!usage) {
      continue;
    }

    if (usage.kind === 'unsafe') {
      return undefined;
    }

    if (kind !== undefined && kind !== usage.kind) {
      // Used as a filter value in one query and a group-by label in another - it can only become one.
      return undefined;
    }
    kind = usage.kind;

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
 * positions" rule. Implemented over the scene graph (not a save-model sweep) so it works
 * identically for v1- and v2-loaded dashboards without depending on either serializer.
 */
function getOutsideQueryReferences(
  scene: DashboardScene,
  variable: QueryVariable,
  pattern: RegExp
): OutsideQueryReferences {
  if (hasBlockingReferences(scene, variable, pattern)) {
    return 'blocking';
  }
  return hasDisplayReferences(scene, pattern) ? 'display' : 'none';
}

function hasDisplayReferences(scene: DashboardScene, pattern: RegExp): boolean {
  // Titles/descriptions of the dashboard, panels, and rows/tabs (in every layout).
  const titled = sceneGraph.findAllObjects(scene, (obj) => {
    const { state } = obj;
    return (
      ('title' in state && matchesVariableReference(state.title, pattern)) ||
      ('description' in state && matchesVariableReference(state.description, pattern))
    );
  });
  if (titled.length > 0) {
    return true;
  }

  for (const panel of dashboardSceneGraph.getVizPanels(scene)) {
    if (
      // Field config covers data links, display names, overrides; options covers e.g. text panel content.
      matchesVariableReference(panel.state.fieldConfig, pattern) ||
      matchesVariableReference(panel.state.options, pattern) ||
      matchesVariableReference(dashboardSceneGraph.getPanelLinks(panel)?.state.rawLinks, pattern) ||
      (panel.state.$data instanceof SceneDataTransformer &&
        matchesVariableReference(panel.state.$data.state.transformations, pattern))
    ) {
      return true;
    }
  }

  return matchesVariableReference(scene.state.links, pattern);
}

function hasBlockingReferences(scene: DashboardScene, variable: QueryVariable, pattern: RegExp): boolean {
  const dataLayers = scene.state.$data;
  if (dataLayers instanceof DashboardDataLayerSet) {
    for (const layer of dataLayers.state.annotationLayers) {
      if ('query' in layer.state && matchesVariableReference(layer.state.query, pattern)) {
        return true;
      }
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
