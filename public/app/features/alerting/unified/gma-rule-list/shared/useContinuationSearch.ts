import { useCallback, useEffect, useRef, useState } from 'react';

export interface ContinuationPage<T> {
  items: T[];
  /** Opaque token for the next page, or undefined when there is no next page. Never inspect
   * its shape or length - only its presence decides whether Load more/Next is offered. */
  continueToken?: string;
}

export type FetchContinuationPage<T> = (continueToken: string | undefined) => Promise<ContinuationPage<T>>;

export interface UseContinuationSearchResult<T> {
  rows: T[];
  /** True only for the first page of the current chain. */
  isLoading: boolean;
  isLoadingMore: boolean;
  /** Set only when the first page failed; rows is empty in that case. */
  error: unknown;
  /** Set only when a later page failed; rows keeps whatever loaded successfully so far. */
  loadMoreError: unknown;
  hasMore: boolean;
  loadMore: () => void;
  /** Re-fetches the first page, replacing all rows. */
  refresh: () => void;
  /** Alias for refresh() - restarts the chain at page one. */
  restart: () => void;
  /** Alias for loadMore() - retries the batch that just failed, using the same continuation
   * token (it is never advanced on failure). */
  retry: () => void;
  /** Total fetches issued by this chain, including the current run - for tests/measurement. */
  requestCount: number;
}

interface ChainState<T> {
  rows: T[];
  continueToken?: string;
  status: 'loading' | 'loaded' | 'error';
  error?: unknown;
  isLoadingMore: boolean;
  loadMoreError?: unknown;
}

function initialState<T>(): ChainState<T> {
  return { rows: [], status: 'loading', isLoadingMore: false };
}

/**
 * Runs one continuation-token pagination chain over a generated POST search mutation (or any
 * async page fetcher with the same shape). Restarts at the first page whenever `resetKey`
 * changes - callers pass a value that captures criteria/mode so a criteria change and a
 * refresh behave the same way. A request generation counter guards against a stale response:
 * once `resetKey` changes or refresh() runs, any in-flight fetch for the previous chain is
 * dropped instead of appending or replacing current rows.
 */
export function useContinuationSearch<T>(
  fetchPage: FetchContinuationPage<T>,
  resetKey: unknown
): UseContinuationSearchResult<T> {
  const [state, setState] = useState<ChainState<T>>(initialState);
  const generationRef = useRef(0);
  const requestCountRef = useRef(0);
  const [requestCount, setRequestCount] = useState(0);
  // Always call the latest fetchPage without making it a dependency of the effect below -
  // callers commonly pass a fresh closure every render.
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const runFirstPage = useCallback(() => {
    const generation = ++generationRef.current;
    setState(initialState());
    requestCountRef.current += 1;
    setRequestCount(requestCountRef.current);

    fetchPageRef.current(undefined).then(
      (page) => {
        if (generation !== generationRef.current) {
          return; // Superseded by a later reset/refresh - never append/replace with a stale response.
        }
        setState({ rows: page.items, continueToken: page.continueToken, status: 'loaded', isLoadingMore: false });
      },
      (error: unknown) => {
        if (generation !== generationRef.current) {
          return;
        }
        setState({ rows: [], status: 'error', error, isLoadingMore: false });
      }
    );
  }, []);

  useEffect(() => {
    runFirstPage();
    // resetKey alone drives restart; runFirstPage is stable (only reads refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const loadMore = useCallback(() => {
    const generation = generationRef.current;
    setState((prev) => ({ ...prev, isLoadingMore: true, loadMoreError: undefined }));
    requestCountRef.current += 1;
    setRequestCount(requestCountRef.current);

    fetchPageRef.current(state.continueToken).then(
      (page) => {
        if (generation !== generationRef.current) {
          return;
        }
        setState((prev) => ({
          ...prev,
          rows: [...prev.rows, ...page.items],
          continueToken: page.continueToken,
          isLoadingMore: false,
        }));
      },
      (error: unknown) => {
        if (generation !== generationRef.current) {
          return;
        }
        setState((prev) => ({ ...prev, isLoadingMore: false, loadMoreError: error }));
      }
    );
  }, [state.continueToken]);

  return {
    rows: state.rows,
    isLoading: state.status === 'loading',
    isLoadingMore: state.isLoadingMore,
    error: state.status === 'error' ? state.error : undefined,
    loadMoreError: state.loadMoreError,
    hasMore: Boolean(state.continueToken),
    loadMore,
    refresh: runFirstPage,
    restart: runFirstPage,
    retry: loadMore,
    requestCount,
  };
}
