import { type SearchQuery } from '../rule-search/searchQueryLeaves';

/** Test-only mirror of the per-kind rule search validation: a message per rejection. */
export function getRuleSearchQueryViolations(query: SearchQuery, kind: 'alert' | 'recording'): string[] {
  const violations: string[] = [];
  const filterable = FILTERABLE_FIELDS[kind];

  const leaves = flattenWhere(query.where, violations);
  const seenFields = new Set<string>();
  let textLeaves = 0;

  for (const leaf of leaves) {
    if ('text' in leaf) {
      textLeaves += 1;
      const { value } = leaf.text;
      if (value.trim() === '') {
        violations.push('text value must not be empty');
      }
      if (/[*%]/.test(value)) {
        violations.push(`text value must not contain wildcards: ${value}`);
      }
    } else if ('regex' in leaf) {
      const { field, pattern } = leaf.regex;
      if (field !== 'labels') {
        violations.push(`regex is only accepted on labels, got ${field}`);
      }
      const key = pattern.split('=')[0];
      if (!pattern.includes('=') || key === '') {
        violations.push(`regex pattern must be key=<regex> with a literal key: ${pattern}`);
      }
    } else {
      violations.push(...getFilterViolations(leaf.filter, filterable, seenFields, kind));
    }
  }

  if (textLeaves > 1) {
    violations.push('at most one text leaf is accepted');
  }
  for (const sort of query.sort) {
    if (sort.field !== 'title') {
      violations.push(`sort is only accepted on title, got ${sort.field}`);
    }
  }
  for (const field of query.fields) {
    if (!RETURNABLE_FIELDS[kind].has(field)) {
      violations.push(`field cannot be returned: ${field}`);
    }
  }
  if (query.limit < 0) {
    violations.push('limit must not be negative');
  }

  return violations;
}

const COMMON_FIELDS = ['name', 'folder', 'paused', 'labels', 'datasourceUIDs', 'health'];
const FILTERABLE_FIELDS = {
  alert: new Set([...COMMON_FIELDS, 'dashboardUID', 'panelID', 'receiver', 'notificationType', 'routingTree', 'state']),
  recording: new Set([...COMMON_FIELDS, 'metric', 'targetDatasourceUID']),
};
const RETURNABLE_FIELDS = {
  alert: new Set([
    'title',
    'folder',
    'paused',
    'labels',
    'annotations',
    'datasourceUIDs',
    'interval',
    'notificationType',
    'receiver',
    'routingTree',
    'dashboardUID',
    'panelID',
    'health',
    'state',
    'stateReason',
    'lastEvaluationTime',
    'evaluationDuration',
    'lastError',
    'totalsHealthy',
    'totalsFiring',
    'totalsPending',
    'totalsRecovering',
    'totalsNoData',
    'totalsError',
  ]),
  recording: new Set([
    'title',
    'folder',
    'paused',
    'labels',
    'datasourceUIDs',
    'interval',
    'metric',
    'targetDatasourceUID',
    'health',
    'lastEvaluationTime',
    'evaluationDuration',
    'lastError',
  ]),
};
const MULTI_VALUE_FIELDS = new Set(['name', 'folder', 'datasourceUIDs', 'state', 'health']);
const NEGATABLE_FIELDS = new Set(['labels', 'state', 'health']);
// The store compares these case-sensitively.
const ALERT_STATE_API_VALUES = new Set(['Inactive', 'Healthy', 'Firing', 'Pending', 'Recovering']);
const HEALTH_API_VALUES = {
  alert: new Set(['Unknown', 'OK', 'Paused', 'Error', 'NoData']),
  recording: new Set(['Unknown', 'Recording', 'Paused', 'Error', 'NoData']),
};
const EXPRESSION_DATASOURCE_UIDS = new Set(['__expr__', '-100', '__ml__']);

type Leaf = Exclude<NonNullable<SearchQuery['where']>, { and: unknown }>;

function flattenWhere(where: SearchQuery['where'], violations: string[]): Leaf[] {
  if (!where) {
    return [];
  }
  if ('and' in where) {
    if (where.and.length === 0) {
      violations.push('and must contain at least one leaf');
    }
    return where.and;
  }
  return [where];
}

function getFilterViolations(
  filter: { field: string; operator: string; values: string[] },
  filterable: Set<string>,
  seenFields: Set<string>,
  kind: 'alert' | 'recording'
): string[] {
  const { field, operator, values } = filter;
  const violations: string[] = [];

  if (!filterable.has(field)) {
    violations.push(`filtering on ${field} is not accepted`);
  }
  if (field !== 'labels') {
    if (seenFields.has(field)) {
      violations.push(`${field} is filtered more than once`);
    }
    seenFields.add(field);
  }
  if (operator !== 'In' && operator !== 'NotIn') {
    violations.push(`operator ${operator} is not accepted`);
  }
  if (operator === 'NotIn' && !NEGATABLE_FIELDS.has(field)) {
    violations.push(`NotIn is not accepted on ${field}`);
  }
  if (values.length === 0 || values.some((value) => value === '' || value.includes('*'))) {
    violations.push(`${field} values must be non-empty and free of wildcards`);
  }
  if (!MULTI_VALUE_FIELDS.has(field) && values.length !== 1) {
    violations.push(`${field} accepts exactly one value`);
  }

  const [first = ''] = values;
  if (field === 'state' && values.some((value) => !ALERT_STATE_API_VALUES.has(value))) {
    violations.push(`state values must be one of ${[...ALERT_STATE_API_VALUES].join(', ')}`);
  }
  if (field === 'health' && values.some((value) => !HEALTH_API_VALUES[kind].has(value))) {
    violations.push(`health values must be one of ${[...HEALTH_API_VALUES[kind]].join(', ')}`);
  }
  if (field === 'paused' && first !== 'true' && first !== 'false') {
    violations.push('paused must be a boolean');
  }
  if (field === 'panelID' && !(/^\d+$/.test(first) && Number(first) > 0)) {
    violations.push('panelID must be a non-zero integer');
  }
  if (field === 'labels' && (first.startsWith('!') || first.includes('!='))) {
    violations.push('label values must not be negated; use NotIn');
  }
  if (field === 'datasourceUIDs') {
    for (const uid of values) {
      if (!/^[a-zA-Z0-9_-]+$/.test(uid) || EXPRESSION_DATASOURCE_UIDS.has(uid)) {
        violations.push(`not a queryable datasource UID: ${uid}`);
      }
    }
  }

  return violations;
}
