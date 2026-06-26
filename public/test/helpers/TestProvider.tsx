import { Store } from '@reduxjs/toolkit';
import * as React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { locationService } from '@grafana/runtime';
import { ModalRoot } from '@grafana/ui';
import { GrafanaContext, GrafanaContextType } from 'app/core/context/GrafanaContext';
import { ModalsContextProvider } from 'app/core/context/ModalsContextProvider';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types/store';

export interface Props {
  storeState?: Partial<StoreState>;
  store?: Store<StoreState>;
  children: React.ReactNode;
  grafanaContext?: GrafanaContextType;
}

/**
 * Wrapps component in redux store provider, Router and GrafanaContext
 *
 * @deprecated Use `test/test-utils` `render` method instead
 */
export function TestProvider(props: Props) {
  const { store = configureStore(props.storeState), children } = props;

  const context = {
    ...getGrafanaContextMock(),
    ...props.grafanaContext,
  };

  return (
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <ModalsContextProvider>
          <CompatRouter>
            <GrafanaContext.Provider value={context}>{children}</GrafanaContext.Provider>
            <ModalRoot />
          </CompatRouter>
        </ModalsContextProvider>
      </Router>
    </Provider>
  );
}
