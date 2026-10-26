import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { type RuleKind } from '../shared/ruleKind';

import { type FilterDefinition } from './filterDefinitions';
import { type FilterIssue, type ParsedSearch, filtersFor, parse } from './parser';
import { type RuleSearchFilter } from './ruleSearchFilter';

export type RuleListMode = 'list' | 'folders';

export interface UseRuleListSearchStateResult {
  /** The applied query, as the user typed it. */
  query: string;
  filter: RuleSearchFilter;
  parseIssues: FilterIssue[];
  filters: FilterDefinition[];
  mode: RuleListMode;
  /** Folders mode supports only the folder filter; any other filter or free text forces List. */
  hasNonFolderFilters: boolean;
  applyQuery: (query: string) => void;
  setMode: (mode: RuleListMode) => void;
}

/**
 * The applied query lives in the `search` URL parameter as typed, so reloads, links and Back/Forward restore it.
 * Any non-folder filter shows List, whatever `view` says. Applying one writes `view=list`; clearing the last
 * removes `view` so the page returns to Folders. A bare `view=list` is kept.
 */
export function useRuleListSearchState(kind: RuleKind): UseRuleListSearchStateResult {
  const [queryParams, updateQueryParams] = useURLSearchParams();

  const query = queryParams.get('search') ?? '';
  const viewParam = queryParams.get('view');

  const parsed = useMemo(() => parse(query, kind), [query, kind]);

  // Enforced on read too, so an incoming URL with `view` missing still opens List for a non-folder filter.
  const hasNonFolderFilters = hasNonFolderCriteria(parsed);
  const mode: RuleListMode = hasNonFolderFilters || viewParam === 'list' ? 'list' : 'folders';

  const applyQuery = useCallback(
    (next: string) => {
      // Writing the same query again would add a history entry for nothing.
      if (next === query) {
        return;
      }
      let view = viewParam ?? undefined;
      if (hasNonFolderCriteria(parse(next, kind))) {
        view = 'list';
      } else if (hasNonFolderFilters) {
        view = undefined;
      }
      updateQueryParams({ search: next, view });
    },
    [updateQueryParams, query, viewParam, kind, hasNonFolderFilters]
  );

  const setMode = useCallback(
    (next: RuleListMode) => {
      // The control disables Folders while a non-folder filter applies.
      if (next === 'folders' && hasNonFolderFilters) {
        return;
      }
      updateQueryParams({ view: next === 'list' ? 'list' : undefined });
    },
    [hasNonFolderFilters, updateQueryParams]
  );

  return {
    query,
    filter: parsed.filter,
    parseIssues: parsed.issues,
    filters: filtersFor(kind),
    mode,
    hasNonFolderFilters,
    applyQuery,
    setMode,
  };
}

/**
 * Checks every filter field but `folders`, so a field added to RuleSearchFilter later is not missed here.
 * A token that failed to parse counts too unless it is a folder token: the user typed a non-folder filter.
 */
function hasNonFolderCriteria({ filter, issues }: ParsedSearch): boolean {
  const hasFilter = Object.entries(filter).some(([key, value]) => key !== 'folders' && isApplied(value));
  return hasFilter || issues.some((issue) => issue.key !== 'folder');
}

function isApplied(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== false;
}
