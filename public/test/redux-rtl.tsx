import { configureStore, EnhancedStore, MiddlewareArray, PreloadedState } from '@reduxjs/toolkit';
import { render as rtlRender } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { AnyAction } from 'redux';
import { ThunkMiddleware } from 'redux-thunk';

import { createRootReducer } from 'app/core/reducers/root';
import { StoreState } from 'app/types';

import { mockNavModel } from './mocks/navModel';

type Store = EnhancedStore<StoreState, AnyAction, MiddlewareArray<[ThunkMiddleware<StoreState, AnyAction, undefined>]>>;

function render(
  ui: React.ReactElement,
  {
    preloadedState = { navIndex: mockNavModel },
    store = configureStore({
      reducer: createRootReducer(),
      preloadedState,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ thunk: true, serializableCheck: false, immutableCheck: false }),
    }),
    ...renderOptions
  }: { preloadedState?: Partial<PreloadedState<StoreState>>; store?: Store } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

export { render };
