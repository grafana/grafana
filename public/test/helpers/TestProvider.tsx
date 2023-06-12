import { ToolkitStore } from '@reduxjs/toolkit/dist/configureStore';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { locationService } from '@grafana/runtime';
import { GrafanaContext, GrafanaContextType } from 'app/core/context/GrafanaContext';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types/store';

export interface Props {
  storeState?: Partial<StoreState>;
  store?: ToolkitStore;
  children: React.ReactNode;
  grafanaContext?: GrafanaContextType;
}

/**
 * Wrapps component in redux store provider, Router and GrafanaContext
 */
export function TestProvider(props: Props) {
  const { store = configureStore(props.storeState), grafanaContext = getGrafanaContextMock(), children } = props;

  return (
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <GrafanaContext.Provider value={grafanaContext}>{children}</GrafanaContext.Provider>
      </Router>
    </Provider>
  );
}
