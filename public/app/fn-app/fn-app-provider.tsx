import React from 'react';
import { Provider } from 'react-redux';

import { config, navigationLogger } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider, PortalContainer } from '@grafana/ui';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { I18nProvider } from 'app/core/internationalization';
import { ThemeProvider } from 'app/core/utils/ConfigProvider';
import { LiveConnectionWarning } from 'app/features/live/LiveConnectionWarning';
import { store, setStore } from 'app/store/store';

import app from '../fn_app';

export const FnAppProvider: React.Component = ({ children }) => {
  navigationLogger('AppWrapper', false, 'rendering');
  return (
    <Provider store={store}>
      <I18nProvider>
        <ErrorBoundaryAlert style="page">
          <GrafanaContext.Provider value={app.context}>
            <ThemeProvider value={config.theme2}>
              <ModalsProvider>
                <GlobalStyles />
                {children}
                <LiveConnectionWarning />
                <ModalRoot />
                <PortalContainer />
              </ModalsProvider>
            </ThemeProvider>
          </GrafanaContext.Provider>
        </ErrorBoundaryAlert>
      </I18nProvider>
    </Provider>
  );
};
