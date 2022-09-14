import React, { useState, useEffect, FC,  } from 'react';
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
import { FNDashboardProps } from './types';

type FnAppProviderProps  = Pick<FNDashboardProps, 'fnError'>;

export const FnAppProvider: FC<FnAppProviderProps> = (props) => {
  const { children, fnError = null } = props;

  const [ready, setReady] = useState(false);
  navigationLogger('AppWrapper', false, 'rendering');
  useEffect(() => {
    loadAndInitAngularIfEnabled()
      .then(() => {
        setReady(true);
        $('.preloader').remove();
      })
      .catch((err) => console.error(err));
    return () => {};
  }, []);

  if (!ready) {
    /**
     * TODO: I think loader would be better
     */
    return <>{fnError}</>;
  }

  if (!store) {
    /**
     * TODO: I think loader would be better
     */
    return <>{fnError}</>;
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
