import { configureStore } from '@reduxjs/toolkit';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

import { alertingAPIv0alpha1 } from '../src/unstable';

// create an empty store
const store = configureStore({
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(alertingAPIv0alpha1.middleware),
  reducer: {
    [alertingAPIv0alpha1.reducerPath]: alertingAPIv0alpha1.reducer,
  },
});

/**
 * Get a wrapper component that implements all of the providers that components
 * within the app will need
 */
const getDefaultWrapper = ({}: RenderOptions) => {
  /**
   * Returns a wrapper that should (eventually?) match the main `AppWrapper`, so any tests are rendering
   * in mostly the same providers as a "real" hierarchy
   */
  return function Wrapper({ children }: React.PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
};

/**
 * Extended [@testing-library/react render](https://testing-library.com/docs/react-testing-library/api/#render)
 * method which wraps the passed element in all of the necessary Providers,
 * so it can render correctly in the context of the application
 */
const customRender = (ui: React.ReactNode, renderOptions: RenderOptions = {}) => {
  const user = userEvent.setup();
  const Providers = renderOptions.wrapper || getDefaultWrapper(renderOptions);

  return {
    ...render(ui, { wrapper: Providers, ...renderOptions }),
    /** Instance of `userEvent.setup()` ready for use to interact with rendered component */
    user,
    store,
  };
};

export * from '@testing-library/react';
export { customRender as render, userEvent };
