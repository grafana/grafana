import { ThunkAction, ThunkDispatch as GenericThunkDispatch } from 'redux-thunk';
import { Action, AnyAction, configureStore, ConfigureStoreOptions, PayloadAction } from '@reduxjs/toolkit';
import type { createRootReducer } from 'app/core/reducers/root';
import { ThunkMiddlewareFor } from '@reduxjs/toolkit/dist/getDefaultMiddleware';

export type StoreState = ReturnType<ReturnType<typeof createRootReducer>>;

/*
 * Utility type to get strongly types thunks
 */
export type ThunkResult<R> = ThunkAction<R, StoreState, undefined, PayloadAction<any>>;

export type ThunkDispatch = GenericThunkDispatch<StoreState, undefined, Action>;

/*
 * This allows us to correctly type dispatch
 */
class FakeConfigureStoreWrapper {
  wrapped(options: ConfigureStoreOptions) {
    return configureStore<StoreState, AnyAction, ReadonlyArray<ThunkMiddlewareFor<StoreState, { thunk: true }>>>(
      options
    );
  }
}

type FakeStoreType = ReturnType<FakeConfigureStoreWrapper['wrapped']>;
let fakeStore: FakeStoreType;
export type AppDispatch = typeof fakeStore.dispatch;
