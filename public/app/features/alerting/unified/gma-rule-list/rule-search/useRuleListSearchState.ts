import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { type RuleKind } from '../shared/ruleKind';

import { alertFilters } from './alertFilters';
import { type FilterDefinition } from './filterDefinitions';
import { type FilterIssue, getFilterIssues } from './filterIssues';
import { parse } from './parser';
import { recordingFilters } from './recordingFilters';
import { type RuleSearchFilter } from './ruleSearchFilter';
import { serialize } from './serializer';

export interface UseRuleListSearchStateResult {
  /** The canonical form of the applied query. */
  query: string;
  filter: RuleSearchFilter;
  issues: FilterIssue[];
  /** The filters this page supports. */
  filters: FilterDefinition[];
  applyQuery: (query: string) => void;
}

/** The applied query lives in the `search` URL parameter, so reloads, links and Back/Forward restore it. */
export function useRuleListSearchState(kind: RuleKind): UseRuleListSearchStateResult {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const filters = kind === 'alert' ? alertFilters : recordingFilters;

  const search = queryParams.get('search') ?? '';

  const filter = useMemo(() => parse(search, filters), [search, filters]);
  const query = useMemo(() => serialize(filter, filters), [filter, filters]);
  const issues = useMemo(() => getFilterIssues(filter, kind), [filter, kind]);

  const applyQuery = useCallback(
    (next: string) => {
      // An empty `search=` is kept, so a cleared search stays cleared once a default saved search fills a missing one.
      updateQueryParams({ search: serialize(parse(next, filters), filters) });
    },
    [updateQueryParams, filters]
  );

  return { query, filter, issues, filters, applyQuery };
}
