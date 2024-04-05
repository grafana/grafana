import { ToolkitStore } from '@reduxjs/toolkit/dist/configureStore';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KBarProvider } from 'kbar';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { PreloadedState } from 'redux';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { config } from '@grafana/runtime';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { GrafanaContext, GrafanaContextType } from 'app/core/context/GrafanaContext';
import { ModalsContextProvider } from 'app/core/context/ModalsContextProvider';
import { ThemeProvider } from 'app/core/utils/ConfigProvider';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types/store';

interface ExtendedRenderOptions extends RenderOptions {
  /**
   * Partial state to use for preloading store when rendering tests
   */
  preloadedState?: PreloadedState<StoreState>;
  /**
   * Optional
   */
  store?: ToolkitStore;
  renderWithRouter?: boolean;
}

/**
 * Wraps children in empty fragment - used to conditionally render in a router or not,
 * as needed by tests
 */
const FragmentWrapper = ({ children }: { children: React.ReactNode }) => {
  return children;
};

/**
 * Get a wrapper component that implements all of the providers that components
 * within the app will need
 */
const getWrapper = ({
  store,
  renderWithRouter,
  grafanaContext,
}: {
  store?: ToolkitStore;
  /**
   * Should the wrapper be generated with a wrapping Router component?
   * Useful if you're testing something that needs more nuanced routing behaviour
   * and you want full control over it instead
   */
  renderWithRouter?: boolean;
  grafanaContext?: GrafanaContextType;
}): React.FC<{ children: React.ReactNode }> => {
  const reduxStore = store || configureStore();
  /**
   * Conditional router - either a MemoryRouter or just a Fragment
   */
  const PotentialRouter = renderWithRouter ? MemoryRouter : FragmentWrapper;

  const context = {
    ...getGrafanaContextMock(),
    ...grafanaContext,
  };

  /**
   * Returns a wrapper that should (closely) match the main `AppWrapper`, so any tests are rendering
   * in mostly the same providers as a "real" hierarchy
   */
  return function Wrapper({ children }: { children?: React.ReactNode }) {
    return (
      <Provider store={reduxStore}>
        <ErrorBoundaryAlert style="page">
          <GrafanaContext.Provider value={context}>
            <ThemeProvider value={config.theme2}>
              <KBarProvider>
                <PotentialRouter>
                  <ModalsContextProvider>{children}</ModalsContextProvider>
                </PotentialRouter>
              </KBarProvider>
            </ThemeProvider>
          </GrafanaContext.Provider>
        </ErrorBoundaryAlert>
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
  const AllTheProviders = renderOptions.wrapper || getWrapper({ store, renderWithRouter });

  return {
    ...render(ui, { wrapper: AllTheProviders, ...renderOptions }),
    store,
  };
};

export * from '@testing-library/react';
export { customRender as render, getWrapper, userEvent };
