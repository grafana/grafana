import { useMemo, useState } from 'react';

import { filterSpans, TraceSpan } from './components';
import { randomId } from './components/utils/filter-spans';

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
}

export interface Tag {
  id: string;
  key?: string;
  operator: string;
  value?: string;
  hideText?: boolean;
}

/**
 * Controls the state of search input that highlights spans if they match the search string.
 * @param spans
 */
export function useSearch(spans?: TraceSpan[]) {
  const [search, setSearch] = useState<SearchProps>({
    spanNameOperator: '=',
    serviceNameOperator: '=',
    fromOperator: '>',
    toOperator: '<',
    tags: [
      {
        id: randomId(),
        operator: '=',
      },
    ],
  });
  const searchMatches: Set<string> | undefined = useMemo(() => {
    return search && spans ? filterSpans(search, spans) : undefined;
  }, [search, spans]);

  return { search, setSearch, searchMatches };
}
