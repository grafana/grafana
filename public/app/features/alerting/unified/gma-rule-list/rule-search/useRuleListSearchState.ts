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
  /** Whether any filter other than the folder filter is applied, which makes Folders unavailable. */
  hasNonFolderFilters: boolean;
  /** True when the URL carries a `search` value at all, whether or not it parses to any filter. */
  hasSearchQuery: boolean;
  setCriteria: (criteria: Criteria, options?: { replace?: boolean }) => void;
  setMode: (mode: RuleListMode) => void;
  reset: () => void;
}

/** Folders mode supports only the folder filter, so any other criterion, including a token the
 * page cannot apply, makes the list a List. Serializing keeps a filter added later from being
 * forgotten here. */
function hasNonFolderCriteria(criteria: Criteria): boolean {
  return serialize({ ...criteria, namespaces: [] }).length > 0;
}

/**
 * Reads/writes the canonical `search` and `view` URL params for one page (Alert or
 * Recording). Any non-folder criterion shows List, whatever `view` says. Applying one writes
 * `view=list`; clearing the last one removes `view`, so the page returns to Folders instead of
 * staying on a List with nothing to list. `view=list` on its own (the user picked List) is kept.
 */
export function useRuleListSearchState(kind: RuleListKind): UseRuleListSearchStateResult {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const registry = kind === 'alert' ? alertTokens : recordingTokens;

  const search = queryParams.get('search') ?? '';
  const viewParam = queryParams.get('view');

  const criteria = useMemo(() => parse(search, registry), [search, registry]);
  const issues = useMemo(() => getCriteriaIssues(criteria, kind), [criteria, kind]);

  // Folders is unavailable while non-folder criteria are active, regardless of what `view`
  // says — this is the one place the rule is enforced on read, not just on write.
  const hasNonFolderFilters = hasNonFolderCriteria(criteria);
  const mode: RuleListMode = hasNonFolderFilters || viewParam === 'list' ? 'list' : 'folders';

  const setCriteria = useCallback(
    (next: Criteria, options?: { replace?: boolean }) => {
      const nextSearch = serialize(next);
      const hasNext = hasNonFolderCriteria(next);
      let nextView = viewParam ?? undefined;
      if (hasNext) {
        nextView = 'list';
      } else if (hasNonFolderFilters) {
        nextView = undefined;
      }
      updateQueryParams({ search: nextSearch.length > 0 ? nextSearch : undefined, view: nextView }, options?.replace);
    },
    [hasNonFolderFilters, updateQueryParams, viewParam]
  );

  const setMode = useCallback(
    (next: RuleListMode) => {
      if (next === 'folders' && hasNonFolderFilters) {
        // Folders is unavailable while non-folder criteria are active — the caller should
        // have disabled the control; this is a defensive no-op, not a silent filter clear.
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
    hasSearchQuery: search.length > 0,
    setCriteria,
    setMode,
    reset,
  };
}
