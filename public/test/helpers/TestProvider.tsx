import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { type Store } from '@reduxjs/toolkit';
import { useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
// eslint-disable-next-line no-restricted-imports
import { Router } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { locationService } from '@grafana/runtime';
import { getTestFeatureFlagClient } from '@grafana/test-utils/feature-flags';
import { ModalRoot } from '@grafana/ui';
import { GrafanaContext, type GrafanaContextType } from 'app/core/context/GrafanaContext';
import { ModalsContextProvider } from 'app/core/context/ModalsContextProvider';
import { configureStore } from 'app/store/configureStore';
import { type StoreState } from 'app/types/store';

export interface Props {
  storeState?: Partial<StoreState>;
  store?: Store<StoreState>;
  children: ReactNode;
  grafanaContext?: GrafanaContextType;
}

/**
 * Wrapps component in redux store provider, Router and GrafanaContext
 *
 * @deprecated Use `test/test-utils` `render` method instead
 */
export function TestProvider(props: Props) {
  const { children } = props;
  // Created once so rerenders keep the same store (RTK Query hooks warn when it changes); storeState is read at mount only.
  const [defaultStore] = useState(() => configureStore(props.storeState));
  const store = props.store ?? defaultStore;

  const context = {
    ...getGrafanaContextMock(),
    ...props.grafanaContext,
  };

  return (
    <Provider store={store}>
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <Router history={locationService.getHistory()}>
          <ModalsContextProvider>
            <CompatRouter>
              <GrafanaContext.Provider value={context}>{children}</GrafanaContext.Provider>
              <ModalRoot />
            </CompatRouter>
          </ModalsContextProvider>
        </Router>
      </OpenFeatureProvider>
    </Provider>
  );
}
