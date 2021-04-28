import { AnyAction, AsyncThunk, createSlice, Draft, isAsyncThunkAction, SerializedError } from '@reduxjs/toolkit';

export interface AsyncRequestState<T> {
  result?: T;
  loading: boolean;
  error?: SerializedError;
  dispatched: boolean;
  requestId?: string;
}

export const initialAsyncRequestState: AsyncRequestState<any> = Object.freeze({
  loading: false,
  dispatched: false,
});

export type AsyncRequestMapSlice<T> = Record<string, AsyncRequestState<T>>;

function requestStateReducer<T, ThunkArg = void, ThunkApiConfig = {}>(
  asyncThunk: AsyncThunk<T, ThunkArg, ThunkApiConfig>,
  state: Draft<AsyncRequestState<T>> = initialAsyncRequestState,
  action: AnyAction
): Draft<AsyncRequestState<T>> {
  if (asyncThunk.pending.match(action)) {
    return {
      result: state.result,
      loading: true,
      error: state.error,
      dispatched: true,
      requestId: action.meta.requestId,
    };
  } else if (asyncThunk.fulfilled.match(action)) {
    if (state.requestId === undefined || state.requestId === action.meta.requestId) {
      return {
        ...state,
        result: action.payload as Draft<T>,
        loading: false,
        error: undefined,
      };
    }
  } else if (asyncThunk.rejected.match(action)) {
    if (state.requestId === action.meta.requestId) {
      return {
        ...state,
        loading: false,
        error: (action as any).error,
      };
    }
  }
  return state;
}

/*
 * createAsyncSlice creates a slice based on a given async action, exposing it's state.
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncSlice<T, ThunkArg = void, ThunkApiConfig = {}>(
  name: string,
  asyncThunk: AsyncThunk<T, ThunkArg, ThunkApiConfig>
) {
  return createSlice({
    name,
    initialState: initialAsyncRequestState as AsyncRequestState<T>,
    reducers: {},
    extraReducers: (builder) =>
      builder.addDefaultCase((state, action) => requestStateReducer(asyncThunk, state, action)),
  });
}

/*
 * createAsyncMapSlice creates a slice based on a given async action exposing a map of request states.
 * separate requests are uniquely indentified by result of provided getEntityId function
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncMapSlice<T, ThunkArg = void, ThunkApiConfig = {}>(
  name: string,
  asyncThunk: AsyncThunk<T, ThunkArg, ThunkApiConfig>,
  getEntityId: (arg: ThunkArg) => string
) {
  return createSlice({
    name,
    initialState: {} as AsyncRequestMapSlice<T>,
    reducers: {},
    extraReducers: (builder) =>
      builder.addDefaultCase((state, action) => {
        if (isAsyncThunkAction(asyncThunk)(action)) {
          const entityId = getEntityId(action.meta.arg);
          return {
            ...state,
            [entityId]: requestStateReducer(asyncThunk, state[entityId], action),
          };
        }
        return state;
      }),
  });
}

// rethrow promise error in redux serialized format
export function withSerializedError<T>(p: Promise<T>): Promise<T> {
  return p.catch((e) => {
    const err: SerializedError = {
      message: e.data?.message || e.message || e.statusText,
      code: e.statusCode,
    };
    throw err;
  });
}
