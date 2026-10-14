import { useCallback, useEffect, useReducer, useRef } from 'react';

import { type TrashFetchResult, initialTrashState, trashHasMore, trashReducer } from './trashPagination';

/**
 * Drives {@link trashReducer} from a small transport function, so this hook (and everything built
 * on it) stays agnostic to whether that function calls the trash-selector collection request or,
 * later, the indexed `/trash` endpoint.
 */
export function useTrashCollection<T>(fetchPage: (continueToken?: string) => Promise<TrashFetchResult<T>>) {
  const [state, dispatch] = useReducer(trashReducer<T>, undefined, initialTrashState<T>);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const pending = state.pendingFetch;

  useEffect(() => {
    if (!pending) {
      return;
    }
    const { isInitial, continueToken, requestId } = pending;
    let cancelled = false;

    fetchPageRef
      .current(continueToken)
      .then((result) => {
        if (!cancelled) {
          dispatch({ type: 'fetchSuccess', requestId, isInitial, result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          dispatch({ type: 'fetchError', requestId, isInitial, error });
        }
      });

    return () => {
      cancelled = true;
    };
    // `pending` (specifically its requestId) is the only thing that should re-trigger the effect;
    // fetchPage itself is read through a ref so a new function identity each render doesn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const refresh = useCallback(() => dispatch({ type: 'requestInitial' }), []);
  const loadMore = useCallback(() => dispatch({ type: 'requestMore' }), []);

  useEffect(() => {
    refresh();
    // Only ever run for the initial request; `refresh` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    rows: state.rows,
    status: state.status,
    error: state.error,
    isLoadingMore: state.isLoadingMore,
    loadMoreError: state.loadMoreError,
    hasMore: trashHasMore(state),
    refresh,
    loadMore,
  };
}
