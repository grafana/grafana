import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';

import { alertTokens } from './alertTokens';
import { type Criteria } from './criteria';
import { type CriteriaIssue, getCriteriaIssues } from './criteriaIssues';
import { parse } from './parser';
import { recordingTokens } from './recordingTokens';
import { serialize } from './serializer';

export type RuleListMode = 'list' | 'folders';
export type RuleListKind = 'alert' | 'recording';

export interface UseRuleListSearchStateResult {
  criteria: Criteria;
  issues: CriteriaIssue[];
  mode: RuleListMode;
  setCriteria: (criteria: Criteria) => void;
  setMode: (mode: RuleListMode) => void;
  reset: () => void;
}

function registryFor(kind: RuleListKind) {
  return kind === 'alert' ? alertTokens : recordingTokens;
}

/** A criterion is folder-only when it's empty or just the folder filter. State/health don't
 * count: they're ignored tokens with no search predicate, so they never force a switch. */
function hasNonFolderCriteria(criteria: Criteria): boolean {
  return (
    criteria.text.length > 0 ||
    criteria.dataSourceUids.length > 0 ||
    criteria.labels.length > 0 ||
    criteria.hidePluginRules ||
    criteria.unresolved.length > 0 ||
    Boolean(
      criteria.dashboardUid ||
        criteria.panelId ||
        criteria.contactPoint ||
        criteria.policy ||
        criteria.paused ||
        criteria.metric ||
        criteria.targetDataSourceUid
    )
  );
}

/**
 * Reads/writes the canonical `search` and `view` URL params for one page (Alert or
 * Recording). Enforces the mode rule on both directions: any non-folder criterion forces
 * List, and once forced, clearing that criterion again does not switch back to Folders on
 * its own — the URL's `view` param is the only source of truth for mode, so it simply keeps
 * whatever it was last explicitly set to.
 */
export function useRuleListSearchState(kind: RuleListKind): UseRuleListSearchStateResult {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const registry = useMemo(() => registryFor(kind), [kind]);

  const search = queryParams.get('search') ?? '';
  const viewParam = queryParams.get('view');

  const criteria = useMemo(() => parse(search, registry).criteria, [search, registry]);
  const issues = useMemo(() => getCriteriaIssues(criteria, kind), [criteria, kind]);

  // Folders is unavailable while non-folder criteria are active, regardless of what `view`
  // says — this is the one place the rule is enforced on read, not just on write.
  const mode: RuleListMode = hasNonFolderCriteria(criteria) || viewParam === 'list' ? 'list' : 'folders';

  const setCriteria = useCallback(
    (next: Criteria) => {
      const nextSearch = serialize(next);
      // Force List once a non-folder criterion is active; otherwise leave `view` exactly as
      // it was, so removing the criterion doesn't silently switch back to Folders.
      const nextView = hasNonFolderCriteria(next) ? 'list' : (viewParam ?? undefined);
      updateQueryParams({ search: nextSearch.length > 0 ? nextSearch : undefined, view: nextView });
    },
    [updateQueryParams, viewParam]
  );

  const setMode = useCallback(
    (next: RuleListMode) => {
      if (next === 'folders' && hasNonFolderCriteria(criteria)) {
        // Folders is unavailable while non-folder criteria are active — the caller should
        // have disabled the control; this is a defensive no-op, not a silent filter clear.
        return;
      }
      updateQueryParams({ view: next === 'list' ? 'list' : undefined });
    },
    [criteria, updateQueryParams]
  );

  const reset = useCallback(() => {
    updateQueryParams({ search: undefined });
  }, [updateQueryParams]);

  return { criteria, issues, mode, setCriteria, setMode, reset };
}
