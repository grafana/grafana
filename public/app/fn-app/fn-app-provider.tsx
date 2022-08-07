import React, { useState, useEffect } from 'react';
import { Provider } from 'react-redux';

import { config, navigationLogger } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider, PortalContainer } from '@grafana/ui';
import { loadAndInitAngularIfEnabled } from 'app/angular/loadAndInitAngularIfEnabled';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { I18nProvider } from 'app/core/internationalization';
import { ThemeProvider } from 'app/core/utils/ConfigProvider';
import { LiveConnectionWarning } from 'app/features/live/LiveConnectionWarning';
import { store } from 'app/store/store';

import app from '../fn_app';

export const FnAppProvider: React.Component = ({ children }) => {
  const [ready, setReady] = useState(false);

  navigationLogger('AppWrapper', false, 'rendering');

  useEffect(() => {
    loadAndInitAngularIfEnabled()
      .then(() => {
        setReady(true);
        $('.preloader').remove();
      })
      .catch((err) => console.error(err));
  }, []);

  if (!ready) {
    // FN:TODO add fn loading logo
    return <h1>App not ready</h1>;
  }

  if (!store) {
    // FN:TODO add fn loading store
    return <h1>No store inited</h1>;
  }
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
