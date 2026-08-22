import { type Draft, type PayloadAction, type SerializedError, createSlice } from '@reduxjs/toolkit';

export interface AsyncRequestState<T> {
  result?: T;
  loading: boolean;
  error?: SerializedError;
  dispatched: boolean;
  requestId?: string;
}
export const initialAsyncRequestState: Pick<
  AsyncRequestState<undefined>,
  'loading' | 'dispatched' | 'result' | 'error'
> = Object.freeze({
  loading: false,
  result: undefined,
  error: undefined,
  dispatched: false,
});

export type AsyncRequestMapSlice<T> = Record<string, AsyncRequestState<T>>;

type AsyncRequestAction<T, ThunkArg> = PayloadAction<
  Draft<T>,
  string,
  { arg: ThunkArg; requestId: string },
  SerializedError
>;

const asyncActionStatuses = ['pending', 'fulfilled', 'rejected'] as const;

function getAsyncActionStatus(typePrefix: string, action: { type: string }) {
  return asyncActionStatuses.find((status) => action.type === `${typePrefix}/${status}`);
}

function requestStateReducer<T, ThunkArg>(
  typePrefix: string,
  state: Draft<AsyncRequestState<T>> = initialAsyncRequestState,
  action: AsyncRequestAction<T, ThunkArg>
): Draft<AsyncRequestState<T>> {
  const status = getAsyncActionStatus(typePrefix, action);

  if (status === 'pending') {
    return {
      result: state.result,
      loading: true,
      error: state.error,
      dispatched: true,
      requestId: action.meta.requestId,
    };
  }

  if (status === 'fulfilled' && (state.requestId === undefined || state.requestId === action.meta.requestId)) {
    return {
      ...state,
      result: action.payload,
      loading: false,
      error: undefined,
    };
  }

  if (status === 'rejected' && state.requestId === action.meta.requestId) {
    return {
      ...state,
      loading: false,
      error: action.error,
    };
  }

  return state;
}

export function createAsyncSlice<T, ThunkArg = void>(name: string, typePrefix: string) {
  return createSlice({
    name,
    initialState: initialAsyncRequestState as AsyncRequestState<T>,
    reducers: {},
    extraReducers: (builder) =>
      builder.addDefaultCase((state, action) =>
        requestStateReducer(typePrefix, state, action as unknown as AsyncRequestAction<T, ThunkArg>)
      ),
  });
}

export function createAsyncMapSlice<T, ThunkArg>(
  name: string,
  typePrefix: string,
  getEntityId: (arg: ThunkArg) => string
) {
  return createSlice({
    name,
    initialState: {} as AsyncRequestMapSlice<T>,
    reducers: {},
    extraReducers: (builder) =>
      builder.addDefaultCase((state, action) => {
        if (!getAsyncActionStatus(typePrefix, action)) {
          return state;
        }

        const asyncAction = action as unknown as AsyncRequestAction<T, ThunkArg>;
        const entityId = getEntityId(asyncAction.meta.arg);
        return {
          ...state,
          [entityId]: requestStateReducer(typePrefix, state[entityId], asyncAction),
        };
      }),
  });
}
