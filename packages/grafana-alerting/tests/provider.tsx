import { configureStore } from '@reduxjs/toolkit';
import { useEffect } from 'react';
import { Provider } from 'react-redux';

import { notificationsAPIv0alpha1 } from '../src/unstable';

// create an empty store
export const store = configureStore({
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(notificationsAPIv0alpha1.middleware),
  reducer: {
    [notificationsAPIv0alpha1.reducerPath]: notificationsAPIv0alpha1.reducer,
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
    useResetQueryCacheAfterUnmount();
    return <Provider store={store}>{children}</Provider>;
  };
};

/**
 * Whenever the test wrapper unmounts, we also want to clear the RTKQ cache entirely.
 * if we don't then we won't be able to test components / stories with different responses for the same endpoint since
 * the responses will be cached between renders / components / stories.
 */
function useResetQueryCacheAfterUnmount() {
  useEffect(() => {
    return () => {
      store.dispatch(notificationsAPIv0alpha1.util.resetApiState());
    };
  }, []);
}
