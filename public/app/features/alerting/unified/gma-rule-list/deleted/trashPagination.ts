/**
 * Transport-independent pagination state for the trash-selector Recently deleted pages.
 *
 * Legacy storage ignores `limit`/`continue` and returns every tombstone in one response; Unified
 * Storage honors `limit` and returns `metadata.continue`. This reducer normalizes both into the
 * same "Load more" experience (40-row chunks) without ever detecting which storage mode produced
 * the response. Keeping this pure
 * (no RTK Query, no React) means the chunking/continue-token/no-duplicate-request/refresh-reset
 * logic can be unit tested directly, and the transport (currently the collection request, later
 * `/alertrules/trash` or `/recordingrules/trash`) can be swapped without touching it.
 */

export const TRASH_PAGE_SIZE = 40;

/** What a transport call returns: a page of items, plus a continuation token if the server has more. */
export interface TrashFetchResult<T> {
  items: T[];
  continueToken?: string;
}

export interface TrashState<T> {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  rows: T[];
  /** Items already fetched but not yet revealed - consumed by Load More before any network request. */
  localBuffer: T[];
  continueToken?: string;
  /** Set while a page (initial or continuation) is in flight; carries a request id to discard stale responses. */
  pendingFetch?: { isInitial: boolean; continueToken?: string; requestId: number };
  isLoadingMore: boolean;
  error?: unknown;
  loadMoreError?: unknown;
  /** Monotonically increasing; bumped by every reset/fetch so a late response from a superseded request can be ignored. */
  requestId: number;
}

export type TrashAction<T> =
  | { type: 'requestInitial' }
  | { type: 'requestMore' }
  | { type: 'fetchSuccess'; requestId: number; isInitial: boolean; result: TrashFetchResult<T> }
  | { type: 'fetchError'; requestId: number; isInitial: boolean; error: unknown };

export function initialTrashState<T>(): TrashState<T> {
  return {
    status: 'idle',
    rows: [],
    localBuffer: [],
    continueToken: undefined,
    pendingFetch: undefined,
    isLoadingMore: false,
    error: undefined,
    loadMoreError: undefined,
    requestId: 0,
  };
}

export function trashHasMore<T>(state: TrashState<T>): boolean {
  return state.localBuffer.length > 0 || Boolean(state.continueToken);
}

export function trashReducer<T>(state: TrashState<T>, action: TrashAction<T>): TrashState<T> {
  switch (action.type) {
    case 'requestInitial': {
      const requestId = state.requestId + 1;
      return {
        ...initialTrashState<T>(),
        status: 'loading',
        requestId,
        pendingFetch: { isInitial: true, continueToken: undefined, requestId },
      };
    }

    case 'requestMore': {
      // Never issue a network request while one is already in flight, and always prefer showing
      // rows already fetched over asking the server for more.
      if (state.pendingFetch || state.status !== 'loaded') {
        return state;
      }
      if (state.localBuffer.length > 0) {
        const nextChunk = state.localBuffer.slice(0, TRASH_PAGE_SIZE);
        const remainder = state.localBuffer.slice(TRASH_PAGE_SIZE);
        return {
          ...state,
          rows: [...state.rows, ...nextChunk],
          localBuffer: remainder,
          loadMoreError: undefined,
        };
      }
      if (!state.continueToken) {
        return state;
      }
      const requestId = state.requestId + 1;
      return {
        ...state,
        requestId,
        isLoadingMore: true,
        loadMoreError: undefined,
        pendingFetch: { isInitial: false, continueToken: state.continueToken, requestId },
      };
    }

    case 'fetchSuccess': {
      if (action.requestId !== state.requestId) {
        // A stale response from a request superseded by a refresh or another load - drop it.
        return state;
      }
      const combined = [...state.localBuffer, ...action.result.items];
      const nextChunk = combined.slice(0, TRASH_PAGE_SIZE);
      const remainder = combined.slice(TRASH_PAGE_SIZE);
      return {
        ...state,
        status: 'loaded',
        rows: [...state.rows, ...nextChunk],
        localBuffer: remainder,
        continueToken: action.result.continueToken,
        pendingFetch: undefined,
        isLoadingMore: false,
        error: undefined,
      };
    }

    case 'fetchError': {
      if (action.requestId !== state.requestId) {
        return state;
      }
      if (action.isInitial) {
        return { ...state, status: 'error', pendingFetch: undefined, isLoadingMore: false, error: action.error };
      }
      // A later failure (Load more / refresh-in-progress) keeps the rows already shown.
      return { ...state, pendingFetch: undefined, isLoadingMore: false, loadMoreError: action.error };
    }

    default:
      return state;
  }
}
