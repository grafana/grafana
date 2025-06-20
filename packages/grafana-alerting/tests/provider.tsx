import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { alertingAPIv0alpha1 } from '../src/unstable';

// create an empty store
export const store = configureStore({
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(alertingAPIv0alpha1.middleware),
  reducer: {
    [alertingAPIv0alpha1.reducerPath]: alertingAPIv0alpha1.reducer,
  },
});

/**
 * Get a wrapper component that implements all of the providers that components
 * within the app will need
 */
export const getDefaultWrapper = () => {
  /**
   * Returns a wrapper that should (eventually?) match the main `AppWrapper`, so any tests are rendering
   * in mostly the same providers as a "real" hierarchy
   */
  return function Wrapper({ children }: React.PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
};
