import { createListenerMiddleware, configureStore as reduxConfigureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { Middleware } from 'redux';

import { addReducer, createRootReducer } from '../reducers/root';
import { StoreState } from '../types/store';

import { setStore } from './store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addRootReducer(reducers: any) {
  // this is ok now because we add reducers before configureStore is called
  // in the future if we want to add reducers during runtime
  // we'll have to solve this in a more dynamic way
  addReducer(reducers);
}

const listenerMiddleware = createListenerMiddleware();
const extraMiddleware: Middleware[] = [];

export function addExtraMiddleware(middleware: Middleware) {
  extraMiddleware.push(middleware);
}

export function configureStore(initialState?: Partial<StoreState>) {
  const store = reduxConfigureStore({
    reducer: createRootReducer(),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: true, serializableCheck: false, immutableCheck: false }).concat(
        listenerMiddleware.middleware,
        ...extraMiddleware
      ),
    devTools: process.env.NODE_ENV !== 'production',
    preloadedState: {
      ...initialState,
    },
  });

  // this enables "refetchOnFocus" and "refetchOnReconnect" for RTK Query
  setupListeners(store.dispatch);

  setStore(store);
  return store;
}

export type RootState = ReturnType<ReturnType<typeof configureStore>['getState']>;
export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];
