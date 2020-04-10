import { useState } from 'react';
import { Span, filterSpans } from '@jaegertracing/jaeger-ui-components';

/**
 * Controls the state of search input that highlights spans if they match the search string.
 * @param spans
 */
export function useSearch(spans?: Span[]) {
  const [search, setSearch] = useState('');
  let spanFindMatches: Set<string> | undefined;
  if (search && spans) {
    spanFindMatches = filterSpans(search, spans);
  }
  return { search, setSearch, spanFindMatches };
}
