import { configureStore } from '@reduxjs/toolkit';
import { render as rtlRender } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { createRootReducer } from 'app/core/reducers/root';
import { StoreState } from 'app/types';

import { mockNavModel } from './mocks/navModel';

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
  }: { preloadedState?: Partial<StoreState>; store?: ReturnType<typeof configureStore> } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

export { render };
