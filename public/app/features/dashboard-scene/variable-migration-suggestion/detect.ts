import { type DataSourceApi, type DrilldownMigrationUsage } from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { dataLayers, QueryVariable, SceneDataTransformer, sceneGraph, type SceneDataQuery } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { containsVariable } from 'app/features/variables/utils';

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
  // Set when the variable's datasource is itself a datasource variable (e.g. `${ds}`): the filters
  // variable should keep that same reference so it follows the dashboard's datasource picker.
  datasourceRef?: DataSourceRef;
}

// Where a variable is referenced outside panel and annotation queries. `display` references
// (titles, links, text, ...) are interpolated on the frontend, where a filter's value is reachable
// through `${filters["<key>"]}`. `blocking` ones have no equivalent once the variable is gone: a
// repeat needs a variable to iterate, and other variables' queries don't get filters injected, while
// `${filters["<key>"]}` renders `All` or nothing there instead of a usable matcher value.
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

    try {
      const candidate = await detectCandidateForVariable(scene, variable, queryUsages);
      if (candidate) {
        candidates.push(candidate);
      }
    } catch {
      // A failing lookup or datasource capability only rules out this variable.
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

  // Annotation layers get filters and group-by injected the same way panel queries do, so their
  // queries are classified like any other rather than treated as a blocking reference.
  for (const layer of getAnnotationLayers(scene)) {
    const annotation = layer.state.query;
    const settings = await getDataSourceInstanceSettings(annotation.datasource);
    // Most datasources keep the query under `target`; older ones keep it at the annotation's root.
    const query = annotation.target ?? annotation;
    usages.push({ query: { ...query, refId: query.refId ?? 'Anno' }, datasourceUid: settings?.uid });
  }

  return usages;
}

function getAnnotationLayers(scene: DashboardScene): dataLayers.AnnotationsDataLayer[] {
  const layerSet = scene.state.$data;
  if (!(layerSet instanceof DashboardDataLayerSet)) {
    return [];
  }
  return layerSet.state.annotationLayers.filter((layer) => layer instanceof dataLayers.AnnotationsDataLayer);
}

async function detectCandidateForVariable(
  scene: DashboardScene,
  variable: QueryVariable,
  queryUsages: QueryUsage[]
): Promise<MigrationSuggestionCandidate | undefined> {
  // A missing ref means the default datasource, and a datasource-variable ref (e.g. `${ds}`) its
  // current value - the lookups below resolve both.
  const variableDsRef = variable.state.datasource;

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

  const name = variable.state.name;

  const crossDatasourceUsage = queryUsages.some(
    (usage) => usage.datasourceUid !== instanceSettings.uid && containsVariable(usage.query, name)
  );
  if (crossDatasourceUsage) {
    return undefined;
  }

  const outsideQueryReferences = getOutsideQueryReferences(scene, variable);
  if (outsideQueryReferences === 'blocking') {
    return undefined;
  }

  const sameDatasourceQueries = queryUsages.filter((usage) => usage.datasourceUid === instanceSettings.uid);

  const datasourceRef = variableDsRef && isDatasourceVariableRef(variableDsRef) ? { datasourceRef: variableDsRef } : {};

  if (typeof ds.getDrilldownMigrationUsage === 'function') {
    const candidate = aggregateHighConfidenceCandidate(ds, variable, instanceSettings.uid, sameDatasourceQueries);
    if (!candidate) {
      return undefined;
    }
    if (outsideQueryReferences === 'none') {
      return { ...candidate, ...datasourceRef };
    }
    // Only a filter's value can be interpolated per key; a group-by has no such equivalent.
    if (!candidate.usages.every((usage) => usage.kind === 'filter')) {
      return undefined;
    }
    return { ...candidate, ...datasourceRef, referencedOutsideQueries: true };
  }

  if (outsideQueryReferences === 'display') {
    // Without the datasource's classification there's no telling whether the variable becomes a
    // filter, so whether its display references can be rewritten at all.
    return undefined;
  }

  // Without a classification, a variable that never appears in a query (only in a title, say) would
  // qualify on the datasource's capabilities alone, so require at least one query usage.
  if (!sameDatasourceQueries.some((usage) => containsVariable(usage.query, name))) {
    return undefined;
  }

  return { variableName: name, datasourceUid: instanceSettings.uid, confidence: 'low', usages: [], ...datasourceRef };
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
    let usage: DrilldownMigrationUsage | undefined;
    try {
      usage = ds.getDrilldownMigrationUsage!({ variableName: variable.state.name, query });
    } catch {
      return undefined;
    }
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

function isDatasourceVariableRef(ref: DataSourceRef): boolean {
  return typeof ref.uid === 'string' && ref.uid.includes('$');
}

/**
 * Where the variable is referenced besides panel and annotation queries (which the datasource
 * classifies). Walks the scene graph rather than a save model, so v1- and v2-loaded dashboards
 * behave the same.
 */
function getOutsideQueryReferences(scene: DashboardScene, variable: QueryVariable): OutsideQueryReferences {
  if (hasBlockingReferences(scene, variable)) {
    return 'blocking';
  }
  return hasDisplayReferences(scene, variable.state.name) ? 'display' : 'none';
}

function hasDisplayReferences(scene: DashboardScene, name: string): boolean {
  // Titles/descriptions of the dashboard, panels, and rows/tabs (in every layout).
  const titled = sceneGraph.findAllObjects(scene, (obj) => {
    const { state } = obj;
    return (
      ('title' in state && containsVariable(state.title, name)) ||
      ('description' in state && containsVariable(state.description, name))
    );
  });
  if (titled.length > 0) {
    return true;
  }

  for (const panel of dashboardSceneGraph.getVizPanels(scene)) {
    if (
      // Field config covers data links, display names, overrides; options covers e.g. text panel content.
      containsVariable(panel.state.fieldConfig, name) ||
      containsVariable(panel.state.options, name) ||
      containsVariable(dashboardSceneGraph.getPanelLinks(panel)?.state.rawLinks, name) ||
      (panel.state.$data instanceof SceneDataTransformer &&
        containsVariable(panel.state.$data.state.transformations, name))
    ) {
      return true;
    }
  }

  // An annotation's own text (name, title/text formats) sits next to its query when the query is
  // under `target`; without `target` the whole annotation was already classified as the query.
  for (const layer of getAnnotationLayers(scene)) {
    const { target, ...annotationText } = layer.state.query;
    if (target && containsVariable(annotationText, name)) {
      return true;
    }
  }

  return containsVariable(scene.state.links, name);
}

function hasBlockingReferences(scene: DashboardScene, variable: QueryVariable): boolean {
  const { name } = variable.state;

  const repeatReferences = sceneGraph.findAllObjects(scene, (obj) => hasVariableNameField(obj.state, name));
  if (repeatReferences.length > 0) {
    return true;
  }

  for (const other of sceneGraph.getVariables(scene).state.variables) {
    if (other === variable) {
      continue;
    }
    // Options and the current value are runtime data, potentially thousands of entries; only the
    // definition (query, regex, datasource, ...) can reference another variable.
    const definition = Object.entries(other.state).filter(([key]) => !VARIABLE_RUNTIME_STATE_KEYS.has(key));
    if (containsVariable(Object.fromEntries(definition), name)) {
      return true;
    }
  }

  return false;
}

const VARIABLE_RUNTIME_STATE_KEYS = new Set(['options', 'value', 'text', 'loading', 'error']);

// Repeat behaviors (row/panel) key off the repeated variable's bare name (no `$` prefix), stored on
// a `variableName` field, so this is a plain name comparison rather than a reference match.
function hasVariableNameField(state: object, name: string): boolean {
  return Object.entries(state).some(([key, value]) => key === 'variableName' && value === name);
}
