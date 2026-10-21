import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { type RuleKind } from '../shared/ruleKind';

import { alertTokens } from './alertTokens';
import { type FilterIssue, getFilterIssues } from './filterIssues';
import { parse } from './parser';
import { recordingTokens } from './recordingTokens';
import { type RuleSearchFilter, createEmptyFilter } from './ruleSearchFilter';
import { serialize } from './serializer';

export type RuleListMode = 'list' | 'folders';
export interface UseRuleListSearchStateResult {
  filter: RuleSearchFilter;
  issues: FilterIssue[];
  mode: RuleListMode;
  hasNonFolderFilters: boolean;
  setFilter: (filter: RuleSearchFilter, options?: { replace?: boolean }) => void;
  setMode: (mode: RuleListMode) => void;
  reset: () => void;
}

/** Folders mode supports only the folder filter. Serializing keeps filters added later from being missed here. */
function hasNonFolderFilter(filter: RuleSearchFilter): boolean {
  return serialize({ ...filter, namespaces: [] }).length > 0;
}

/** The `search` and `view` params that apply `next`, following the `view` rules of useRuleListSearchState. */
export function searchParamsForFilter(next: RuleSearchFilter, view: string | null, hadNonFolderFilters: boolean) {
  const search = serialize(next);
  let nextView = view ?? undefined;
  if (hasNonFolderFilter(next)) {
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
export function useRuleListSearchState(kind: RuleKind): UseRuleListSearchStateResult {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const registry = kind === 'alert' ? alertTokens : recordingTokens;

  const search = queryParams.get('search') ?? '';
  const viewParam = queryParams.get('view');

  const filter = useMemo(() => parse(search, registry), [search, registry]);
  const issues = useMemo(() => getFilterIssues(filter, kind), [filter, kind]);

  // The one place the Folders restriction is enforced on read, not just on write.
  const hasNonFolderFilters = hasNonFolderFilter(filter);
  const mode: RuleListMode = hasNonFolderFilters || viewParam === 'list' ? 'list' : 'folders';

  const setFilter = useCallback(
    (next: RuleSearchFilter, options?: { replace?: boolean }) => {
      updateQueryParams(searchParamsForFilter(next, viewParam, hasNonFolderFilters), options?.replace);
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

  const reset = useCallback(() => setFilter(createEmptyFilter()), [setFilter]);

  return {
    filter,
    issues,
    mode,
    hasNonFolderFilters,
    setFilter,
    setMode,
    reset,
  };
}
