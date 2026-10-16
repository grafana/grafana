import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';

import { alertTokens } from './alertTokens';
import { type Criteria, createEmptyCriteria } from './criteria';
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
  hasNonFolderFilters: boolean;
  setCriteria: (criteria: Criteria, options?: { replace?: boolean }) => void;
  setMode: (mode: RuleListMode) => void;
  reset: () => void;
}

/** Folders mode supports only the folder filter. Serializing keeps filters added later from being missed here. */
function hasNonFolderCriteria(criteria: Criteria): boolean {
  return serialize({ ...criteria, namespaces: [] }).length > 0;
}

/** The `search` and `view` params that apply `next`, following the `view` rules of useRuleListSearchState. */
export function searchParamsForCriteria(next: Criteria, view: string | null, hadNonFolderFilters: boolean) {
  const search = serialize(next);
  let nextView = view ?? undefined;
  if (hasNonFolderCriteria(next)) {
    nextView = 'list';
  } else if (hadNonFolderFilters) {
    nextView = undefined;
  }
  // An empty `search=` is kept so a reload stays unfiltered instead of reapplying the default saved search.
  return { search, view: nextView };
}

/**
 * Any non-folder criterion shows List, whatever `view` says. Applying one writes `view=list`;
 * clearing the last removes `view` so the page returns to Folders. A bare `view=list` is kept.
 */
export function useRuleListSearchState(kind: RuleListKind): UseRuleListSearchStateResult {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const registry = kind === 'alert' ? alertTokens : recordingTokens;

  const search = queryParams.get('search') ?? '';
  const viewParam = queryParams.get('view');

  const criteria = useMemo(() => parse(search, registry), [search, registry]);
  const issues = useMemo(() => getCriteriaIssues(criteria, kind), [criteria, kind]);

  // The one place the Folders restriction is enforced on read, not just on write.
  const hasNonFolderFilters = hasNonFolderCriteria(criteria);
  const mode: RuleListMode = hasNonFolderFilters || viewParam === 'list' ? 'list' : 'folders';

  const setCriteria = useCallback(
    (next: Criteria, options?: { replace?: boolean }) => {
      updateQueryParams(searchParamsForCriteria(next, viewParam, hasNonFolderFilters), options?.replace);
    },
    [hasNonFolderFilters, updateQueryParams, viewParam]
  );

  const setMode = useCallback(
    (next: RuleListMode) => {
      if (next === 'folders' && hasNonFolderFilters) {
        // Defensive no-op: the caller should have disabled the control.
        return;
      }
      updateQueryParams({ view: next === 'list' ? 'list' : undefined });
    },
    [hasNonFolderFilters, updateQueryParams]
  );

  const reset = useCallback(() => setCriteria(createEmptyCriteria()), [setCriteria]);

  return {
    criteria,
    issues,
    mode,
    hasNonFolderFilters,
    setCriteria,
    setMode,
    reset,
  };
}
