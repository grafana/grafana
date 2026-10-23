import { type RuleKind } from '../shared/ruleKind';

import { DEFAULT_POLICY, type RuleSearchFilter, type SearchLabelMatcher } from './ruleSearchFilter';

type FilterIssueReason = 'unsupported' | 'requiresDashboard' | 'unavailable' | 'invalid' | 'wildcardInText';

export interface FilterIssue {
  /** The token key as typed. */
  key: string;
  reason: FilterIssueReason;
}

/** Callers must show these tokens as invalid and skip the request; builders never fix them up silently. */
export function getFilterIssues(filter: RuleSearchFilter, kind: RuleKind): FilterIssue[] {
  const issues: FilterIssue[] = filter.invalid.map((token) => ({ key: token.key, reason: 'unsupported' }));

  const flagInvalidValue = (key: string) => issues.push({ key, reason: 'invalid' });

  // The title text search treats these as wildcards, which the rule search refuses. Free text and `rule:` share the
  // one title search, so the issue can't name the word it came from.
  if (filter.text.some((word) => /[*%]/.test(word))) {
    issues.push({ key: 'rule', reason: 'wildcardInText' });
  }
  if (filter.folders.some(hasWildcard)) {
    flagInvalidValue('folder');
  }
  if (filter.dataSourceUids.some((uid) => !isQueryDatasourceUid(uid))) {
    flagInvalidValue('datasource');
  }
  if (filter.labels.some(isRejectedLabel)) {
    flagInvalidValue('label');
  }

  if (kind === 'alert') {
    if (filter.panelId && !filter.dashboardUid) {
      issues.push({ key: 'panelId', reason: 'requiresDashboard' });
    } else if (filter.panelId && !isPositiveInteger(filter.panelId)) {
      flagInvalidValue('panelId');
    }
    if (filter.dashboardUid && hasWildcard(filter.dashboardUid)) {
      flagInvalidValue('dashboard');
    }
    if (filter.policy === DEFAULT_POLICY) {
      issues.push({ key: 'policy', reason: 'unavailable' });
    } else if (filter.policy && hasWildcard(filter.policy)) {
      flagInvalidValue('policy');
    }
    // A rule routes either through a policy or straight to a contact point, so the two never match together.
    if (filter.contactPoint && (filter.policy || hasWildcard(filter.contactPoint))) {
      flagInvalidValue('contactPoint');
    }
    // `paused In [false]` misses rules stored without a `paused` value until the backend indexes it as false.
    if (filter.paused === 'false') {
      issues.push({ key: 'paused', reason: 'unavailable' });
    }
  } else {
    if (filter.metric && hasWildcard(filter.metric)) {
      flagInvalidValue('metric');
    }
    if (filter.targetDataSourceUid && hasWildcard(filter.targetDataSourceUid)) {
      flagInvalidValue('targetDatasource');
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

// Mimics the rule search's backend validation, which rejects these UIDs with a 400. Whether the data source
// exists isn't checked: an unknown UID matches no rules, like an unknown folder.
function isQueryDatasourceUid(uid: string): boolean {
  return DATASOURCE_UID_PATTERN.test(uid) && !EXPRESSION_DATASOURCE_UIDS.has(uid);
}

function isRejectedLabel(label: SearchLabelMatcher): boolean {
  if (label.operator === 'regex' || label.operator === 'notRegex') {
    // Regex values are patterns, so a literal asterisk is meaningful there.
    return false;
  }
  const term =
    label.operator === 'equal' || label.operator === 'notEqual' ? `${label.key}=${label.value ?? ''}` : label.key;
  // A leading "!" or an embedded "!=" would make the matcher's polarity ambiguous next to the operator.
  return hasWildcard(term) || term.startsWith('!') || term.includes('!=');
}

const DATASOURCE_UID_PATTERN = /^[a-zA-Z0-9_-]+$/;
// Expression nodes aren't data sources the backend indexes, so it rejects their UIDs.
const EXPRESSION_DATASOURCE_UIDS = new Set(['__expr__', '-100', '__ml__']);
