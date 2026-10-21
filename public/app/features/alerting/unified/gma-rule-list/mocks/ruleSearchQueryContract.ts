import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type SearchQueryNode } from '../rule-search/searchQueryLeaves';
import { type RuleKind } from '../shared/ruleKind';

/** What the checker reads from a built request body of either kind. */
export interface CheckedSearchQuery {
  where?: SearchQueryNode;
  sort: Array<{ field: string; direction?: string }>;
  fields: string[];
  limit: number;
}

/** Test-only mirror of the per-kind rule search validation: a message per rejection. */
export function getRuleSearchQueryViolations(query: CheckedSearchQuery, kind: RuleKind): string[] {
  const violations: string[] = [];
  const fields = FIELDS[kind];

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
      violations.push(...getFilterViolations(leaf.filter, fields, seenFields));
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
    if (!fields[field]?.returnable) {
      violations.push(`field cannot be returned: ${field}`);
    }
  }
  if (query.limit < 0) {
    violations.push('limit must not be negative');
  }

  return violations;
}

/** What the rule search accepts for one field. */
interface FieldRule {
  /** The field can be requested in `fields`. */
  returnable?: true;
  /** The field can be filtered on. */
  filter?: {
    multiValue?: true;
    /** `NotIn` is accepted. */
    negatable?: true;
    /** The only accepted values; the store compares them case-sensitively. */
    values?: readonly string[];
    /** A check on each value, with the reason it fails. */
    valid?: { test: (value: string) => boolean; reason: string };
  };
}

const SHARED_FIELDS = {
  title: { returnable: true },
  name: { filter: { multiValue: true } },
  folder: { returnable: true, filter: { multiValue: true } },
  paused: { returnable: true, filter: { values: ['true', 'false'] } },
  labels: {
    returnable: true,
    filter: {
      negatable: true,
      valid: {
        test: (value) => !value.startsWith('!') && !value.includes('!='),
        reason: 'must not be negated; use NotIn',
      },
    },
  },
  datasourceUIDs: {
    returnable: true,
    filter: {
      multiValue: true,
      valid: {
        test: (value) => /^[a-zA-Z0-9_-]+$/.test(value) && !['__expr__', '-100', '__ml__'].includes(value),
        reason: 'is not a queryable datasource UID',
      },
    },
  },
  interval: { returnable: true },
  lastEvaluationTime: { returnable: true },
  evaluationDuration: { returnable: true },
  lastError: { returnable: true },
} satisfies Record<string, FieldRule>;

const FIELDS: Record<RuleKind, Record<string, FieldRule | undefined>> = {
  alert: {
    ...SHARED_FIELDS,
    health: {
      returnable: true,
      filter: {
        multiValue: true,
        negatable: true,
        values: ['Unknown', 'OK', 'Paused', 'Error', 'NoData'] satisfies AlertRuleAlertRuleHealth[],
      },
    },
    state: {
      returnable: true,
      filter: {
        multiValue: true,
        negatable: true,
        values: ['Inactive', 'Healthy', 'Firing', 'Pending', 'Recovering'] satisfies AlertRuleAlertRuleState[],
      },
    },
    dashboardUID: { returnable: true, filter: {} },
    panelID: {
      returnable: true,
      filter: {
        valid: { test: (value) => /^\d+$/.test(value) && Number(value) > 0, reason: 'must be a non-zero integer' },
      },
    },
    receiver: { returnable: true, filter: {} },
    notificationType: { returnable: true, filter: {} },
    routingTree: { returnable: true, filter: {} },
    annotations: { returnable: true },
    stateReason: { returnable: true },
    totalsHealthy: { returnable: true },
    totalsFiring: { returnable: true },
    totalsPending: { returnable: true },
    totalsRecovering: { returnable: true },
    totalsNoData: { returnable: true },
    totalsError: { returnable: true },
  },
  recording: {
    ...SHARED_FIELDS,
    health: {
      returnable: true,
      filter: {
        multiValue: true,
        negatable: true,
        values: ['Unknown', 'Recording', 'Paused', 'Error', 'NoData'] satisfies RecordingRuleRecordingRuleHealth[],
      },
    },
    metric: { returnable: true, filter: {} },
    targetDatasourceUID: { returnable: true, filter: {} },
  },
};

type Leaf = Exclude<SearchQueryNode, { and: unknown }>;

function flattenWhere(where: CheckedSearchQuery['where'], violations: string[]): Leaf[] {
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
  fields: Record<string, FieldRule | undefined>,
  seenFields: Set<string>
): string[] {
  const { field, operator, values } = filter;
  const rule = fields[field]?.filter;
  const violations: string[] = [];

  if (!rule) {
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
  if (operator === 'NotIn' && !rule?.negatable) {
    violations.push(`NotIn is not accepted on ${field}`);
  }
  if (values.length === 0 || values.some((value) => value === '' || value.includes('*'))) {
    violations.push(`${field} values must be non-empty and free of wildcards`);
  }
  if (!rule?.multiValue && values.length !== 1) {
    violations.push(`${field} accepts exactly one value`);
  }
  if (rule?.values && values.some((value) => !rule.values?.includes(value))) {
    violations.push(`${field} values must be one of ${rule.values.join(', ')}`);
  }
  for (const value of values) {
    if (rule?.valid && !rule.valid.test(value)) {
      violations.push(`${field} value ${value} ${rule.valid.reason}`);
    }
  }

  return violations;
}
