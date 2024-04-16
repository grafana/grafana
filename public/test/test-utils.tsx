import { ToolkitStore } from '@reduxjs/toolkit/dist/configureStore';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps, Fragment, PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { PreloadedState } from 'redux';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { GrafanaContext, GrafanaContextType } from 'app/core/context/GrafanaContext';
import { ModalsContextProvider } from 'app/core/context/ModalsContextProvider';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types/store';

interface ExtendedRenderOptions extends RenderOptions {
  /**
   * Optional store to use for rendering. If not provided, a fresh store will be generated
   * via `configureStore` method
   */
  store?: ToolkitStore;
  /**
   * Partial state to use for preloading store when rendering tests
   */
  preloadedState?: PreloadedState<StoreState>;
  /**
   * Should the wrapper be generated with a wrapping Router component?
   * Useful if you're testing something that needs more nuanced routing behaviour
   * and you want full control over it instead
   */
  renderWithRouter?: boolean;
  /**
   * Props to pass to `MemoryRouter`, if being used
   */
  routerOptions?: ComponentProps<typeof MemoryRouter>;
}

/**
 * Get a wrapper component that implements all of the providers that components
 * within the app will need
 */
const getWrapper = ({
  store,
  renderWithRouter,
  routerOptions,
  grafanaContext,
}: ExtendedRenderOptions & {
  grafanaContext?: GrafanaContextType;
}) => {
  const reduxStore = store || configureStore();
  /**
   * Conditional router - either a MemoryRouter or just a Fragment
   */
  const PotentialRouter = renderWithRouter ? MemoryRouter : Fragment;

  const context = {
    ...getGrafanaContextMock(),
    ...grafanaContext,
  };

  /**
   * Returns a wrapper that should (eventually?) match the main `AppWrapper`, so any tests are rendering
   * in mostly the same providers as a "real" hierarchy
   */
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={reduxStore}>
        <GrafanaContext.Provider value={context}>
          <PotentialRouter {...routerOptions}>
            <ModalsContextProvider>{children}</ModalsContextProvider>
          </PotentialRouter>
        </GrafanaContext.Provider>
      </Provider>
    );
  };
};

/**
 * Extended [@testing-library/react render](https://testing-library.com/docs/react-testing-library/api/#render)
 * method which wraps the passed element in all of the necessary Providers,
 * so it can render correctly in the context of the application
 */
const customRender = (
  ui: React.ReactElement,
  { renderWithRouter = true, ...renderOptions }: ExtendedRenderOptions = {}
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = renderOptions.preloadedState ? configureStore(renderOptions?.preloadedState as any) : undefined;
  const AllTheProviders = renderOptions.wrapper || getWrapper({ store, renderWithRouter, ...renderOptions });

  return {
    ...render(ui, { wrapper: AllTheProviders, ...renderOptions }),
    store,
  };
};

export * from '@testing-library/react';
export { customRender as render, getWrapper, userEvent };
