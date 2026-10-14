import { useCallback, useEffect, useRef, useState } from 'react';

import { type ContinuationPage, type FetchContinuationPage } from '../shared/useContinuationSearch';

export interface UseFolderPagesResult<T> {
  items: T[];
  isLoading: boolean;
  error: unknown;
  hasNext: boolean;
  hasPrevious: boolean;
  next: () => void;
  previous: () => void;
  /** Total fetches issued - for tests/measurement. */
  requestCount: number;
}

interface PagesState<T> {
  status: 'loading' | 'loaded' | 'error';
  items: T[];
  error?: unknown;
  nextToken?: string;
}

/**
 * Folders mode's Previous/Next pagination: the folder search API has no page numbers, so
 * visited page-start continuation tokens are kept in an in-memory stack (index = page number)
 * rather than re-derived. Restarts at page one whenever `resetKey` changes.
 */
export function useFolderPages<T>(fetchPage: FetchContinuationPage<T>, resetKey: unknown): UseFolderPagesResult<T> {
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<PagesState<T>>({ status: 'loading', items: [] });
  const tokenStackRef = useRef<Array<string | undefined>>([undefined]);
  const generationRef = useRef(0);
  const requestCountRef = useRef(0);
  const [requestCount, setRequestCount] = useState(0);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const loadPage = useCallback((index: number) => {
    const generation = ++generationRef.current;
    setState((prev) => ({ ...prev, status: 'loading' }));
    requestCountRef.current += 1;
    setRequestCount(requestCountRef.current);

    fetchPageRef.current(tokenStackRef.current[index]).then(
      (page: ContinuationPage<T>) => {
        if (generation !== generationRef.current) {
          return;
        }
        setState({ status: 'loaded', items: page.items, nextToken: page.continueToken });
      },
      (error: unknown) => {
        if (generation !== generationRef.current) {
          return;
        }
        setState((prev) => ({ ...prev, status: 'error', error }));
      }
    );
  }, []);

  useEffect(() => {
    tokenStackRef.current = [undefined];
    setPageIndex(0);
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const next = useCallback(() => {
    if (!state.nextToken) {
      return;
    }
    const nextIndex = pageIndex + 1;
    tokenStackRef.current[nextIndex] = state.nextToken;
    setPageIndex(nextIndex);
    loadPage(nextIndex);
  }, [state.nextToken, pageIndex, loadPage]);

  const previous = useCallback(() => {
    if (pageIndex === 0) {
      return;
    }
    const prevIndex = pageIndex - 1;
    setPageIndex(prevIndex);
    loadPage(prevIndex);
  }, [pageIndex, loadPage]);

  return {
    items: state.items,
    isLoading: state.status === 'loading',
    error: state.status === 'error' ? state.error : undefined,
    hasNext: Boolean(state.nextToken),
    hasPrevious: pageIndex > 0,
    next,
    previous,
    requestCount,
  };
}
