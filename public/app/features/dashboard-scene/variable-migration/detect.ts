import { PromVariableQueryType } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryVariable, sceneGraph, type SceneDataQuery, type VariableValue } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { type DashboardScene } from '../scene/DashboardScene';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../utils/utils';

import { classifyVariableUsagesInExpr, textReferencesVariable } from './promqlVariableUsage';

export type MigrationCandidateKind = 'filter' | 'groupBy' | 'both';

export type DisqualificationReason =
  | { code: 'datasource-variable-ref' }
  | { code: 'datasource-not-found' }
  | { code: 'cross-datasource-usage'; detail: string }
  | { code: 'query-parse-error'; detail: string }
  | { code: 'unsafe-position'; detail: string }
  | { code: 'ambiguous-filter-key'; detail: string }
  | { code: 'not-used-in-queries' }
  | { code: 'panel-repeat' }
  | { code: 'referenced-outside-queries'; detail: string }
  | { code: 'save-model-serialization-failed' };

export interface MigrationCandidate {
  variableName: string;
  /** Datasource ref as stored on the variable (null means the default datasource). */
  datasourceRef: DataSourceRef | null;
  /** Resolved datasource uid; undefined when the ref could not be resolved. */
  datasourceUid?: string;
  labelQueryKind: 'labelNames' | 'labelValues';
  /** Undefined until usages have been classified (or when there are none). */
  kind?: MigrationCandidateKind;
  /** The single label key of all filter usages (set when kind includes filter and the key is unambiguous). */
  filterKey?: string;
  /** Matcher operators seen at filter usage positions ('=' and/or '=~'). */
  filterOperators: string[];
  /** Number of panel queries that reference the variable. */
  queryCount: number;
  currentValue?: VariableValue | null;
  disqualified: boolean;
  reasons: DisqualificationReason[];
}

/**
 * Finds Prometheus label-name/label-value query variables in the dashboard and determines
 * whether they can be migrated to the unified drilldown control (adhoc filters + groupBy).
 * Disqualified variables are still returned, flagged with the reasons, so UI can render
 * them as disabled. Pure inspection: never mutates the scene.
 */
export function detectMigratableVariables(dashboard: DashboardScene): MigrationCandidate[] {
  const variables = sceneGraph.getVariables(dashboard).state.variables;
  const panelQueries = collectPanelQueries(dashboard);

  let saveModel: unknown;
  let saveModelFailed = false;
  try {
    saveModel = dashboard.getSaveModel();
  } catch {
    saveModelFailed = true;
  }

  const candidates: MigrationCandidate[] = [];

  for (const variable of variables) {
    if (!(variable instanceof QueryVariable)) {
      continue;
    }

    const labelQueryKind = getPromLabelQueryKind(variable.state.query);
    if (!labelQueryKind) {
      continue;
    }

    const varDs = resolveDatasource(variable.state.datasource);
    if (!varDs.isVariableRef && varDs.uid !== undefined && varDs.type !== 'prometheus') {
      // A concrete non-Prometheus datasource: not a Prometheus variable at all.
      continue;
    }

    const candidate: MigrationCandidate = {
      variableName: variable.state.name,
      datasourceRef: variable.state.datasource,
      datasourceUid: varDs.uid,
      labelQueryKind,
      filterOperators: [],
      queryCount: 0,
      currentValue: variable.getValue(),
      disqualified: false,
      reasons: [],
    };

    if (varDs.isVariableRef) {
      candidate.reasons.push({ code: 'datasource-variable-ref' });
    } else if (varDs.uid === undefined) {
      candidate.reasons.push({ code: 'datasource-not-found' });
    } else {
      classifyUsages(candidate, panelQueries);
    }

    checkRepeatUsage(candidate, dashboard);

    if (saveModelFailed) {
      candidate.reasons.push({ code: 'save-model-serialization-failed' });
    } else {
      sweepSaveModelReferences(candidate, saveModel, panelQueries);
    }

    candidate.disqualified = candidate.reasons.length > 0;
    candidates.push(candidate);
  }

  return candidates;
}

const labelNamesRegex = /^label_names\(\)\s*$/;
const labelValuesRegex = /^label_values\((?:(.+),\s*)?(.+)\)\s*$/;

/**
 * Recognizes the Label names / Label values Prometheus variable query in all its stored
 * forms: structured qryType, bare legacy string, and the migrated {query}/{expr} shapes.
 * The recognizer regexes mirror @grafana/prometheus src/migrations/variableMigration.ts
 * (not exported from the package).
 */
export function getPromLabelQueryKind(query: string | SceneDataQuery): 'labelNames' | 'labelValues' | undefined {
  if (typeof query === 'string') {
    return getKindFromQueryString(query);
  }

  if (!query || typeof query !== 'object') {
    return undefined;
  }

  if ('qryType' in query && query.qryType !== undefined) {
    if (query.qryType === PromVariableQueryType.LabelNames) {
      return 'labelNames';
    }
    if (query.qryType === PromVariableQueryType.LabelValues) {
      return 'labelValues';
    }
    return undefined;
  }

  const queryString =
    'query' in query && typeof query.query === 'string'
      ? query.query
      : 'expr' in query && typeof query.expr === 'string'
        ? query.expr
        : undefined;

  return queryString === undefined ? undefined : getKindFromQueryString(queryString);
}

function getKindFromQueryString(query: string): 'labelNames' | 'labelValues' | undefined {
  if (labelNamesRegex.test(query)) {
    return 'labelNames';
  }
  if (labelValuesRegex.test(query)) {
    return 'labelValues';
  }
  return undefined;
}

interface PanelQueryInfo {
  refId?: string;
  expr?: string;
  /** Serialized query for cheap "does it reference the variable at all" checks. */
  json: string;
  dsUid?: string;
  dsIsVariableRef: boolean;
}

function collectPanelQueries(dashboard: DashboardScene): PanelQueryInfo[] {
  const infos: PanelQueryInfo[] = [];

  for (const panel of dashboardSceneGraph.getVizPanels(dashboard)) {
    const queryRunner = getQueryRunnerFor(panel);
    if (!queryRunner) {
      continue;
    }

    for (const query of queryRunner.state.queries ?? []) {
      const ds = resolveDatasource(query.datasource ?? queryRunner.state.datasource ?? null);

      infos.push({
        refId: query.refId,
        expr: 'expr' in query && typeof query.expr === 'string' ? query.expr : undefined,
        json: JSON.stringify(query),
        dsUid: ds.uid,
        dsIsVariableRef: ds.isVariableRef,
      });
    }
  }

  return infos;
}

function resolveDatasource(ref: DataSourceRef | string | null): {
  uid?: string;
  type?: string;
  isVariableRef: boolean;
} {
  const uidOrName = typeof ref === 'string' ? ref : ref?.uid;
  if (typeof uidOrName === 'string' && uidOrName.includes('$')) {
    // A datasource-variable reference: which datasource it points at can change at any
    // time, so whether the migration is safe is undecidable.
    return { isVariableRef: true };
  }

  const settings = getDataSourceSrv().getInstanceSettings(ref);
  return settings ? { uid: settings.uid, type: settings.type, isVariableRef: false } : { isVariableRef: false };
}

function classifyUsages(candidate: MigrationCandidate, panelQueries: PanelQueryInfo[]) {
  const filterKeys = new Set<string>();
  const operators = new Set<string>();
  let filterCount = 0;
  let groupByCount = 0;

  for (const query of panelQueries) {
    if (!textReferencesVariable(query.json, candidate.variableName)) {
      continue;
    }

    candidate.queryCount++;

    if (query.dsIsVariableRef || query.dsUid === undefined || query.dsUid !== candidate.datasourceUid) {
      candidate.reasons.push({
        code: 'cross-datasource-usage',
        detail: `query ${query.refId ?? ''} runs on a different datasource`.trim(),
      });
      continue;
    }

    if (query.expr === undefined || !textReferencesVariable(query.expr, candidate.variableName)) {
      // Referenced only in non-expr query fields (e.g. legend format); the save-model
      // sweep reports those.
      continue;
    }

    const { usages, hasParseError } = classifyVariableUsagesInExpr(query.expr, candidate.variableName);

    if (hasParseError) {
      candidate.reasons.push({
        code: 'query-parse-error',
        detail: `query ${query.refId ?? ''} could not be parsed`.trim(),
      });
      continue;
    }

    for (const usage of usages) {
      if (usage.position === 'filterValue') {
        filterCount++;
        filterKeys.add(usage.labelKey);
        operators.add(usage.operator);
      } else if (usage.position === 'groupByLabel') {
        groupByCount++;
      } else {
        candidate.reasons.push({ code: 'unsafe-position', detail: usage.context });
      }
    }
  }

  if (filterKeys.size > 1) {
    candidate.reasons.push({
      code: 'ambiguous-filter-key',
      detail: [...filterKeys].sort().join(', '),
    });
  } else if (filterKeys.size === 1) {
    candidate.filterKey = [...filterKeys][0];
  }

  candidate.filterOperators = [...operators].sort();

  if (filterCount > 0 && groupByCount > 0) {
    candidate.kind = 'both';
  } else if (filterCount > 0) {
    candidate.kind = 'filter';
  } else if (groupByCount > 0) {
    candidate.kind = 'groupBy';
  } else {
    candidate.reasons.push({ code: 'not-used-in-queries' });
  }
}

function checkRepeatUsage(candidate: MigrationCandidate, dashboard: DashboardScene) {
  // Panel/row/tab repeats all keep the repeated variable in a `variableName` state field
  // (DashboardGridItem, AutoGridItem, RowRepeaterBehavior, RowItemRepeatBehavior, ...).
  const repeaters = sceneGraph.findAllObjects(dashboard, (obj) => {
    const variableName = 'variableName' in obj.state ? obj.state.variableName : undefined;
    return typeof variableName === 'string' && variableName === candidate.variableName;
  });

  if (repeaters.length > 0) {
    candidate.reasons.push({ code: 'panel-repeat' });
  }
}

/**
 * Conservative sweep for references to the variable anywhere in the serialized dashboard
 * outside the already-classified panel query exprs: titles, text panels, data links,
 * annotation queries, other variables' definitions, etc.
 */
function sweepSaveModelReferences(candidate: MigrationCandidate, saveModel: unknown, panelQueries: PanelQueryInfo[]) {
  const classifiedExprs = new Set<string>();
  for (const query of panelQueries) {
    if (query.expr !== undefined) {
      classifiedExprs.add(query.expr);
    }
  }

  const visit = (value: unknown, path: string, key: string) => {
    if (typeof value === 'string') {
      if (key === 'expr' && classifiedExprs.has(value)) {
        return;
      }
      if (textReferencesVariable(value, candidate.variableName)) {
        candidate.reasons.push({ code: 'referenced-outside-queries', detail: path });
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, key));
      return;
    }

    if (value && typeof value === 'object') {
      if (isOwnVariableDefinition(value, candidate.variableName)) {
        return;
      }
      for (const [childKey, childValue] of Object.entries(value)) {
        visit(childValue, path ? `${path}.${childKey}` : childKey, childKey);
      }
    }
  };

  visit(saveModel, '', '');
}

function isOwnVariableDefinition(value: object, variableName: string): boolean {
  // v1 save model: templating.list entry
  if ('type' in value && value.type === 'query' && 'name' in value && value.name === variableName) {
    return true;
  }

  // v2 save model: variables entry
  if ('kind' in value && value.kind === 'QueryVariable' && 'spec' in value) {
    const spec = value.spec;
    return typeof spec === 'object' && spec !== null && 'name' in spec && spec.name === variableName;
  }

  return false;
}
