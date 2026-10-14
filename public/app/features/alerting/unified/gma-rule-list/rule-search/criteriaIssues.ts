import { type Criteria, DEFAULT_POLICY, type LabelMatcher } from './criteria';

/** Matches the token key the user typed, so the input can name the offending filters. */
export type CriteriaIssueKey =
  | 'namespace'
  | 'datasource'
  | 'panelId'
  | 'rule'
  | 'label'
  | 'dashboard'
  | 'contactPoint'
  | 'policy'
  | 'metric'
  | 'targetDatasource';

/**
 * - `unresolved`: a migrated name that never resolved to a UID.
 * - `requiresDashboard`: a panel ID with no dashboard to scope it to.
 * - `unavailable`: a criterion the rule search cannot express yet.
 * - `invalid`: a value the rule search rejects outright.
 */
export type CriteriaIssueReason = 'unresolved' | 'requiresDashboard' | 'unavailable' | 'invalid';

export interface CriteriaIssue {
  key: CriteriaIssueKey;
  reason: CriteriaIssueReason;
  /** Only set for 'unresolved' — the original display name that could not be resolved. */
  value?: string;
}

const DATASOURCE_UID_PATTERN = /^[a-zA-Z0-9_-]+$/;
// Datasource UIDs of server-side expression nodes are never indexed, so filtering on one is rejected.
const EXPRESSION_DATASOURCE_UIDS = new Set(['__expr__', '-100', '__ml__']);

/**
 * Reports problems with `criteria` that the page layer must act on before issuing a search
 * request: a migrated folder/datasource name that never resolved to a UID, a panel ID with no
 * dashboard to scope it to (panel IDs are dashboard-local), a criterion the rule search
 * cannot express, or a value it would reject. The request builders never fix these up on
 * their own: silently sending a narrower or wider request than the user asked for would be
 * worse than not searching at all. When this returns any issues, the caller should show the
 * offending token(s) as invalid and skip the request rather than send one.
 */
export function getCriteriaIssues(criteria: Criteria, kind: 'alert' | 'recording'): CriteriaIssue[] {
  const issues: CriteriaIssue[] = criteria.unresolved.map((entry) => ({
    key: entry.key,
    reason: 'unresolved',
    value: entry.value,
  }));

  const invalid = (key: CriteriaIssueKey) => issues.push({ key, reason: 'invalid' });

  // The title text search treats these as wildcards, which the rule search refuses.
  if (criteria.text.some((word) => /[*%]/.test(word))) {
    invalid('rule');
  }
  if (criteria.namespaces.some(hasWildcard)) {
    invalid('namespace');
  }
  if (criteria.dataSourceUids.some((uid) => !isQueryDatasourceUid(uid))) {
    invalid('datasource');
  }
  if (criteria.labels.some(isRejectedLabel)) {
    invalid('label');
  }

  if (kind === 'alert') {
    if (criteria.panelId && !criteria.dashboardUid) {
      issues.push({ key: 'panelId', reason: 'requiresDashboard' });
    } else if (criteria.panelId && !isPositiveInteger(criteria.panelId)) {
      invalid('panelId');
    }
    if (criteria.dashboardUid && hasWildcard(criteria.dashboardUid)) {
      invalid('dashboard');
    }
    if (criteria.policy === DEFAULT_POLICY) {
      issues.push({ key: 'policy', reason: 'unavailable' });
    } else if (criteria.policy && hasWildcard(criteria.policy)) {
      invalid('policy');
    }
    if (criteria.contactPoint && hasWildcard(criteria.contactPoint)) {
      invalid('contactPoint');
    }
  } else {
    if (criteria.metric && hasWildcard(criteria.metric)) {
      invalid('metric');
    }
    if (criteria.targetDataSourceUid && hasWildcard(criteria.targetDataSourceUid)) {
      invalid('targetDatasource');
    }
  }

  return issues;
}

function hasWildcard(value: string): boolean {
  return value.includes('*');
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function isQueryDatasourceUid(uid: string): boolean {
  return DATASOURCE_UID_PATTERN.test(uid) && !EXPRESSION_DATASOURCE_UIDS.has(uid);
}

function isRejectedLabel(label: LabelMatcher): boolean {
  if (label.operator === 'regex' || label.operator === 'notRegex') {
    // Regex values are patterns, so a literal asterisk is meaningful there.
    return false;
  }
  const term =
    label.operator === 'equal' || label.operator === 'notEqual' ? `${label.key}=${label.value ?? ''}` : label.key;
  // A leading "!" or an embedded "!=" would make the matcher's polarity ambiguous next to the operator.
  return hasWildcard(term) || term.startsWith('!') || term.includes('!=');
}
