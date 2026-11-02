import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';

import { type FilterHelp, type RuleSearchSchema } from './filterDefinitions';
import { type FilterIssue, type ParsedSearch, parse } from './parser';
import { type SharedRuleFilter } from './sharedRuleFilter';

export type RuleListMode = 'list' | 'folders';

export interface UseRuleListSearchStateResult<Filter extends SharedRuleFilter> {
  /** The applied query, as the user typed it. */
  query: string;
  filter: Filter;
  parseIssues: FilterIssue[];
  /** The page's filters as the search help shows them. */
  filterHelp: FilterHelp[];
  mode: RuleListMode;
  /** Folders mode supports only the folder filter; any other filter or free text forces List. */
  hasNonFolderFilters: boolean;
  applyQuery: (query: string) => void;
  setMode: (mode: RuleListMode) => void;
}

/**
 * The applied query lives in the `search` URL parameter as typed, so reloads, links and Back/Forward restore it.
 * Any non-folder filter shows List, whatever `view` says, so `view` records only the mode the user chose and
 * clearing the last such filter returns to it.
 * `schema` should be a module-level constant: a new one on every render parses the query again.
 */
export function useRuleListSearchState<Filter extends SharedRuleFilter>(
  schema: RuleSearchSchema<Filter>
): UseRuleListSearchStateResult<Filter> {
  const [queryParams, updateQueryParams] = useURLSearchParams();

  const query = queryParams.get('search') ?? '';
  const viewParam = queryParams.get('view');

  const parsed = useMemo(() => parse(query, schema), [query, schema]);

  const hasNonFolderFilters = hasNonFolderCriteria(parsed);
  const mode: RuleListMode = hasNonFolderFilters || viewParam === 'list' ? 'list' : 'folders';

  const applyQuery = useCallback(
    (next: string) => {
      // Writing the same query again would add a history entry for nothing.
      if (next === query) {
        return;
      }
      updateQueryParams({ search: next });
    },
    [updateQueryParams, query]
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
    filterHelp: schema.filters,
    mode,
    hasNonFolderFilters,
    applyQuery,
    setMode,
  };
}

/**
 * Checks every filter field but `folders`, so a field added to a page's filter later is not missed here.
 * A token that failed to parse counts too unless it is a folder token: the user typed a non-folder filter.
 */
function hasNonFolderCriteria({ filter, issues }: ParsedSearch<SharedRuleFilter>): boolean {
  const hasFilter = Object.entries(filter).some(([key, value]) => key !== 'folders' && isApplied(value));
  return hasFilter || issues.some((issue) => issue.key !== 'folder');
}

function isApplied(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== false;
}
