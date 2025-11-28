import { configureStore } from '@reduxjs/toolkit';
import { useEffect } from 'react';
import { Provider } from 'react-redux';

import { MockBackendSrv } from '@grafana/api-clients';
import { generatedAPI as notificationsAPIv0alpha1 } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { generatedAPI as rulesAPIv0alpha1 } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';

// Initialize BackendSrv for tests - this allows RTKQ to make HTTP requests
// The actual HTTP requests will be intercepted by MSW (setupMockServer)
// We only need to implement fetch() which is what RTKQ uses
// we could remove this once @grafana/api-client no longer uses the BackendSrv
// @ts-ignore
setBackendSrv(new MockBackendSrv());

// create an empty store
export const store: ReturnType<typeof configureStore> = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(notificationsAPIv0alpha1.middleware).concat(rulesAPIv0alpha1.middleware),
  reducer: {
    [notificationsAPIv0alpha1.reducerPath]: notificationsAPIv0alpha1.reducer,
    [rulesAPIv0alpha1.reducerPath]: rulesAPIv0alpha1.reducer,
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
