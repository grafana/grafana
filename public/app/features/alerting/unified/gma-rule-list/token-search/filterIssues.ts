import { type RuleKind } from '../shared/ruleKind';

import { DEFAULT_POLICY, type LabelMatcher, type RuleSearchFilter } from './ruleSearchFilter';

export type FilterIssueReason = 'unsupported' | 'requiresDashboard' | 'unavailable' | 'invalid';

export interface FilterIssue {
  /** The token key as typed. */
  key: string;
  reason: FilterIssueReason;
  /** The token exactly as typed, for unsupported tokens, so the message can say what would work. */
  raw?: string;
}

const DATASOURCE_UID_PATTERN = /^[a-zA-Z0-9_-]+$/;
// Server-side expression node datasource UIDs are never indexed, so filtering on one is rejected.
const EXPRESSION_DATASOURCE_UIDS = new Set(['__expr__', '-100', '__ml__']);

/** Callers must show these tokens as invalid and skip the request; builders never fix them up silently. */
export function getFilterIssues(filter: RuleSearchFilter, kind: RuleKind): FilterIssue[] {
  const issues: FilterIssue[] = filter.invalid.map((token) => ({
    key: token.key,
    reason: 'unsupported',
    raw: token.raw,
  }));

  const invalid = (key: string) => issues.push({ key, reason: 'invalid' });

  // The title text search treats these as wildcards, which the rule search refuses.
  if (filter.text.some((word) => /[*%]/.test(word))) {
    invalid('rule');
  }
  if (filter.namespaces.some(hasWildcard)) {
    invalid('namespace');
  }
  if (filter.dataSourceUids.some((uid) => !isQueryDatasourceUid(uid))) {
    invalid('datasource');
  }
  if (filter.labels.some(isRejectedLabel)) {
    invalid('label');
  }

  if (kind === 'alert') {
    if (filter.panelId && !filter.dashboardUid) {
      issues.push({ key: 'panelId', reason: 'requiresDashboard' });
    } else if (filter.panelId && !isPositiveInteger(filter.panelId)) {
      invalid('panelId');
    }
    if (filter.dashboardUid && hasWildcard(filter.dashboardUid)) {
      invalid('dashboard');
    }
    if (filter.policy === DEFAULT_POLICY) {
      issues.push({ key: 'policy', reason: 'unavailable' });
    } else if (filter.policy && hasWildcard(filter.policy)) {
      invalid('policy');
    }
    if (filter.contactPoint && hasWildcard(filter.contactPoint)) {
      invalid('contactPoint');
    }
  } else {
    if (filter.metric && hasWildcard(filter.metric)) {
      invalid('metric');
    }
    if (filter.targetDataSourceUid && hasWildcard(filter.targetDataSourceUid)) {
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
