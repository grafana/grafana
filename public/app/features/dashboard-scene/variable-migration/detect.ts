import { PromVariableQueryType } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryVariable, sceneGraph, type SceneDataQuery, type VariableValue } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { type DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../utils/utils';

import { classifyVariableUsagesInExpr, textReferencesVariable } from './promqlVariableUsage';

export type MigrationCandidateKind = 'filter' | 'groupBy' | 'both';

export type DisqualificationReason =
  | { code: 'datasource-variable-ref' }
  | { code: 'datasource-not-found' }
  | { code: 'cross-datasource-usage'; detail: string }
  | { code: 'query-parse-error'; detail: string }
  | { code: 'unsupported-variable-syntax'; detail: string }
  | { code: 'unsafe-position'; detail: string }
  | { code: 'ambiguous-filter-key'; detail: string }
  | { code: 'empty-current-value' }
  | { code: 'not-used-in-queries' }
  | { code: 'panel-repeat' }
  | { code: 'library-panel'; detail: string }
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
      // Raw stored value, not getValue(): All must stay visible as $__all, not expand
      // into the option values (or [] when options are not loaded yet).
      currentValue: variable.state.value,
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
  /** Queries of library panels are shared content and must never be migrated. */
  isLibraryPanel: boolean;
}

function collectPanelQueries(dashboard: DashboardScene): PanelQueryInfo[] {
  const infos: PanelQueryInfo[] = [];

  for (const panel of dashboardSceneGraph.getVizPanels(dashboard)) {
    const queryRunner = getQueryRunnerFor(panel);
    if (!queryRunner) {
      continue;
    }

    const isLibraryPanel = panel.state.$behaviors?.some((b) => b instanceof LibraryPanelBehavior) ?? false;

    for (const query of queryRunner.state.queries ?? []) {
      const ds = resolveDatasource(query.datasource ?? queryRunner.state.datasource ?? null);

      infos.push({
        refId: query.refId,
        expr: 'expr' in query && typeof query.expr === 'string' ? query.expr : undefined,
        json: JSON.stringify(query),
        dsUid: ds.uid,
        dsIsVariableRef: ds.isVariableRef,
        isLibraryPanel,
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

    if (query.isLibraryPanel) {
      candidate.reasons.push({
        code: 'library-panel',
        detail: `query ${query.refId ?? ''} belongs to a library panel`.trim(),
      });
      continue;
    }

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

    const { usages, hasParseError, hasUnsupportedSyntax } = classifyVariableUsagesInExpr(
      query.expr,
      candidate.variableName
    );

    if (hasParseError) {
      candidate.reasons.push({
        code: 'query-parse-error',
        detail: `query ${query.refId ?? ''} could not be parsed`.trim(),
      });
      continue;
    }

    if (hasUnsupportedSyntax) {
      // Field paths / exotic formats anywhere in the expr defeat the rewriter (see
      // hasUnsupportedVariableSyntax), so nothing in this expr can be migrated.
      candidate.reasons.push({
        code: 'unsupported-variable-syntax',
        detail: `query ${query.refId ?? ''} uses variable syntax the rewriter does not support`.trim(),
      });
      continue;
    }

    for (const usage of usages) {
      if (usage.position === 'filterValue') {
        if (!isSupportedFilterFormat(usage.format, usage.operator)) {
          candidate.reasons.push({
            code: 'unsafe-position',
            detail: `unsupported format specifier ":${usage.format}" in a label matcher`,
          });
          continue;
        }
        filterCount++;
        filterKeys.add(usage.labelKey);
        operators.add(usage.operator);
      } else if (usage.position === 'groupByLabel') {
        if (usage.format !== undefined && usage.format !== 'csv') {
          candidate.reasons.push({
            code: 'unsafe-position',
            detail: `unsupported format specifier ":${usage.format}" in by(...)`,
          });
          continue;
        }
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

  // An empty current value seeds no filter while its matcher would still be stripped,
  // silently turning `{key=~""}` (match empty/absent label) into match-all. Only `$__all`
  // sanctions that equivalence. GroupBy usages are unaffected: an empty grouping value
  // renders `by()` which already equals the bare aggregation the rewrite produces.
  if (
    (candidate.kind === 'filter' || candidate.kind === 'both') &&
    hasEmptyCurrentValue(candidate.currentValue) &&
    !isAllValue(candidate.currentValue)
  ) {
    candidate.reasons.push({ code: 'empty-current-value' });
  }
}

function hasEmptyCurrentValue(value: MigrationCandidate['currentValue']): boolean {
  if (value == null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0 || value.some((entry) => String(entry) === '');
  }
  return String(value) === '';
}

function isAllValue(value: MigrationCandidate['currentValue']): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some((entry) => String(entry) === ALL_VARIABLE_VALUE);
}

/**
 * Format specifiers that a seeded adhoc filter can reproduce: none at all, or the
 * multi-value joins (`:regex`, `:pipe`) under a regex matcher — those become the one-of
 * (`=|`) / regex operators. Everything else (csv, json, raw, ...) changes the rendered
 * text in ways a filter control cannot express.
 */
function isSupportedFilterFormat(format: string | undefined, operator: string): boolean {
  if (format === undefined) {
    return true;
  }
  return operator === '=~' && (format === 'regex' || format === 'pipe');
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

interface ExprSkip {
  expr: string;
  used: boolean;
}

/**
 * Conservative sweep for references to the variable anywhere in the serialized dashboard
 * outside the already-classified panel query exprs: titles, text panels, data links,
 * annotation queries, other variables' definitions, etc.
 *
 * Panel query exprs are skipped positionally, not by string equality: only the serialized
 * panel-query containers (v1 `panels[].targets[]` entries, v2 `PanelQuery` kinds) may skip
 * their expr, each budgeted against the queries collected from the scene, so an annotation
 * or another variable carrying a byte-identical expr is still flagged.
 */
function sweepSaveModelReferences(candidate: MigrationCandidate, saveModel: unknown, panelQueries: PanelQueryInfo[]) {
  const skipBudget = new Map<string, number>();
  for (const query of panelQueries) {
    if (query.expr !== undefined) {
      const key = budgetKey(query.refId, query.expr);
      skipBudget.set(key, (skipBudget.get(key) ?? 0) + 1);
    }
  }

  const tryConsumeSkip = (refId: unknown, expr: unknown): ExprSkip | undefined => {
    if (typeof expr !== 'string') {
      return undefined;
    }
    const key = budgetKey(typeof refId === 'string' ? refId : undefined, expr);
    const remaining = skipBudget.get(key) ?? 0;
    if (remaining <= 0) {
      return undefined;
    }
    skipBudget.set(key, remaining - 1);
    return { expr, used: false };
  };

  const visit = (value: unknown, path: string, key: string, skip: ExprSkip | undefined) => {
    if (typeof value === 'string') {
      if (key === 'expr' && skip !== undefined && !skip.used && value === skip.expr) {
        skip.used = true;
        return;
      }
      if (textReferencesVariable(value, candidate.variableName)) {
        candidate.reasons.push({ code: 'referenced-outside-queries', detail: path });
      }
      return;
    }

    if (Array.isArray(value)) {
      if (key === 'targets') {
        // v1 panel query containers: refId and expr sit side by side on each target
        value.forEach((item, index) =>
          visit(item, `${path}[${index}]`, key, tryConsumeSkip(getProp(item, 'refId'), getProp(item, 'expr')))
        );
        return;
      }
      value.forEach((item, index) => visit(item, `${path}[${index}]`, key, skip));
      return;
    }

    if (value && typeof value === 'object') {
      if (isOwnVariableDefinition(value, candidate.variableName)) {
        return;
      }

      let ownSkip = skip;
      if (ownSkip === undefined && getProp(value, 'kind') === 'PanelQuery') {
        // v2 panel query containers: { kind: 'PanelQuery', spec: { refId, query: { spec: { expr } } } }
        const spec = getProp(value, 'spec');
        ownSkip = tryConsumeSkip(getProp(spec, 'refId'), getProp(getProp(getProp(spec, 'query'), 'spec'), 'expr'));
      }

      for (const [childKey, childValue] of Object.entries(value)) {
        visit(childValue, path ? `${path}.${childKey}` : childKey, childKey, ownSkip);
      }
    }
  };

  visit(saveModel, '', '', undefined);
}

function budgetKey(refId: string | undefined, expr: string): string {
  return `${refId ?? ''}\u0000${expr}`;
}

function getProp(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  return Object.entries(value).find(([entryKey]) => entryKey === key)?.[1];
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
