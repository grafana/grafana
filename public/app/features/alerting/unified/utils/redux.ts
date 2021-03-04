import { AsyncThunk, createSlice } from '@reduxjs/toolkit';

export interface AsyncRequestState<T> {
  result?: T;
  loading: boolean;
  error?: unknown;
  dispatched: boolean;
  requestId?: string;
}

const defaultAsyncRequestState: AsyncRequestState<any> = {
  loading: false,
  dispatched: false,
};

/*
 * createAsyncSlice creates a slice based on a given async action, exposing it's state.
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncSlice<T, ThunkArg = void, ThunkApiConfig = {}>(
  name: string,
  action: AsyncThunk<T, ThunkArg, ThunkApiConfig>
) {
  return createSlice({
    name,
    initialState: defaultAsyncRequestState as AsyncRequestState<T>,
    reducers: {},
    extraReducers: (builder) =>
      builder
        .addCase(action.pending, (state, action) => ({
          result: state.result,
          loading: true,
          error: undefined,
          dispatched: true,
          requestId: action.meta.requestId,
        }))
        .addCase(action.fulfilled, (state, action) => {
          if (state.requestId === action.meta.requestId) {
            return {
              ...state,
              result: action.payload,
              loading: false,
            };
          }
          return state;
        })
        .addCase(action.rejected, (state, action) => {
          if (state.requestId === action.meta.requestId) {
            return {
              ...state,
              loading: false,
              error: action.payload,
            };
          }
          return state;
        }),
  });
}
