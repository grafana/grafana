import { type Criteria } from './criteria';

export type CriteriaIssueKey = 'namespace' | 'datasource' | 'panelId';
export type CriteriaIssueReason = 'unresolved' | 'requiresDashboard';

export interface CriteriaIssue {
  key: CriteriaIssueKey;
  reason: CriteriaIssueReason;
  /** Only set for 'unresolved' — the original display name that could not be resolved. */
  value?: string;
}

/**
 * Reports structural problems with `criteria` that the page layer must act on before
 * issuing a search request: a migrated folder/datasource name that never resolved to a UID,
 * or a panel ID with no dashboard to scope it to (panel IDs are dashboard-local). The
 * request builders never fix these up on their own: silently sending a narrower or wider
 * request than the user asked for would be worse than not searching at all. When this
 * returns any issues, the caller should show the offending token(s) as invalid and skip the
 * request rather than send one.
 */
export function getCriteriaIssues(criteria: Criteria, kind: 'alert' | 'recording'): CriteriaIssue[] {
  const issues: CriteriaIssue[] = criteria.unresolved.map((entry) => ({
    key: entry.key,
    reason: 'unresolved',
    value: entry.value,
  }));

  if (kind === 'alert' && criteria.panelId && !criteria.dashboardUid) {
    issues.push({ key: 'panelId', reason: 'requiresDashboard' });
  }

  return issues;
}
