import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { createRootReducer } from 'app/core/reducers/root';
import { mockNavModel } from './mocks/navModel';

function render(
  ui: React.ReactElement,
  {
    preloadedState,
    store = configureStore({
      reducer: createRootReducer(),
      preloadedState: {
        navIndex: mockNavModel,
        ...preloadedState,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ thunk: true, serializableCheck: false, immutableCheck: false }),
    }),
    ...renderOptions
  }: any = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

export * from '@testing-library/react';
export { render };
