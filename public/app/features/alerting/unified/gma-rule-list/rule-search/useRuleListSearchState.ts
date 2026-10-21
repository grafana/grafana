import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { type RuleKind } from '../shared/ruleKind';

import { type FilterDefinition } from './filterDefinitions';
import { type FilterIssue, filtersFor, parse } from './parser';
import { type RuleSearchFilter } from './ruleSearchFilter';

export interface UseRuleListSearchStateResult {
  /** The applied query, as the user typed it. */
  query: string;
  filter: RuleSearchFilter;
  parseIssues: FilterIssue[];
  filters: FilterDefinition[];
  applyQuery: (query: string) => void;
}

/** The applied query lives in the `search` URL parameter as typed, so reloads, links and Back/Forward restore it. */
export function useRuleListSearchState(kind: RuleKind): UseRuleListSearchStateResult {
  const [queryParams, updateQueryParams] = useURLSearchParams();

  const query = queryParams.get('search') ?? '';

  const { filter, issues: parseIssues } = useMemo(() => parse(query, kind), [query, kind]);

  const applyQuery = useCallback(
    (next: string) => {
      // Writing the same query again would add a history entry for nothing.
      if (next !== query) {
        updateQueryParams({ search: next });
      }
    },
    [updateQueryParams, query]
  );

  return { query, filter, parseIssues, filters: filtersFor(kind), applyQuery };
}
