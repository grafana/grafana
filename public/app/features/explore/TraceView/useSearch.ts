import { cloneDeep, merge } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { InterpolateFunction } from '@grafana/data';

import { filterSpans, TraceSpan } from './components';

export interface SearchProps {
  serviceName?: string;
  serviceNameOperator: string;
  spanName?: string;
  spanNameOperator: string;
  from?: string;
  fromOperator: string;
  to?: string;
  toOperator: string;
  tags: Tag[];
  query?: string;
  matchesOnly: boolean;
  criticalPathOnly: boolean;
}

export interface Tag {
  id: string;
  key?: string;
  operator: string;
  value?: string;
}

export const randomId = () => uuidv4().slice(0, 12);

export const defaultTagFilter = {
  id: randomId(),
  operator: '=',
};

export const defaultFilters = {
  spanNameOperator: '=',
  serviceNameOperator: '=',
  fromOperator: '>',
  toOperator: '<',
  tags: [defaultTagFilter],
  matchesOnly: false,
  criticalPathOnly: false,
};

/**
 * Controls the state of search input that highlights spans if they match the search string.
 * @param spans
 */
export function useSearch(spans?: TraceSpan[], initialFilters?: SearchProps) {
  const [search, setSearch] = useState<SearchProps>(merge(cloneDeep(defaultFilters), initialFilters ?? {}));

  useEffect(() => {
    if (initialFilters) {
      setSearch((prev) => {
        return merge(cloneDeep(prev), initialFilters);
      });
    }
  }, [initialFilters]);

  const spanFilterMatches: Set<string> | undefined = useMemo(() => {
    return spans && filterSpans(search, spans);
  }, [search, spans]);

  return { search, setSearch, spanFilterMatches };
}

export function replaceSearchVariables(replaceVariables: InterpolateFunction, search?: SearchProps) {
  if (!search) {
    return search;
  }

  const newSearch = { ...search };
  if (newSearch.query) {
    newSearch.query = replaceVariables(newSearch.query);
  }
  if (newSearch.serviceNameOperator) {
    newSearch.serviceNameOperator = replaceVariables(newSearch.serviceNameOperator);
  }
  if (newSearch.serviceName) {
    newSearch.serviceName = replaceVariables(newSearch.serviceName);
  }
  if (newSearch.spanNameOperator) {
    newSearch.spanNameOperator = replaceVariables(newSearch.spanNameOperator);
  }
  if (newSearch.spanName) {
    newSearch.spanName = replaceVariables(newSearch.spanName);
  }
  if (newSearch.from) {
    newSearch.from = replaceVariables(newSearch.from);
  }
  if (newSearch.to) {
    newSearch.to = replaceVariables(newSearch.to);
  }
  if (newSearch.tags) {
    newSearch.tags = newSearch.tags.map((tag) => {
      return {
        ...tag,
        key: replaceVariables(tag.key ?? ''),
        value: replaceVariables(tag.value ?? ''),
      };
    });
  }

  return newSearch;
}
