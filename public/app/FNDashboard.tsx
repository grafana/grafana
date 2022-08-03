import React, { ComponentType } from 'react';
import { Provider } from 'react-redux';

import { config, navigationLogger } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider, PortalContainer } from '@grafana/ui';
import { store } from 'app/store/store';

import { loadAndInitAngularIfEnabled } from './angular/loadAndInitAngularIfEnabled';
import { GrafanaApp } from './app';
import { GrafanaContext } from './core/context/GrafanaContext';
import { I18nProvider } from './core/internationalization';
import { ThemeProvider } from './core/utils/ConfigProvider';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';
import fn_app from './fn_app';
fn_app.init();

interface DefaultProps {}

/** Used by enterprise */
let bodyRenderHooks: ComponentType[] = [];
let pageBanners: ComponentType[] = [];

export function addBodyRenderHook(fn: ComponentType) {
  bodyRenderHooks.push(fn);
}

export function addPageBanner(fn: ComponentType) {
  pageBanners.push(fn);
}

export class FNDashboard extends React.Component<DefaultProps> {
  app!: GrafanaApp;
  constructor(props: DefaultProps) {
    super(props);
    this.state = {};
    this.app = fn_app;
  }

  async componentDidMount() {
    await loadAndInitAngularIfEnabled();
    this.setState({ ready: true });
    $('.preloader').remove();
  }

  render() {
    navigationLogger('AppWrapper', false, 'rendering');

    return (
      <Provider store={store}>
        <I18nProvider>
          <ErrorBoundaryAlert style="page">
            <GrafanaContext.Provider value={this.app.context}>
              <ThemeProvider value={config.theme2}>
                <ModalsProvider>
                  <GlobalStyles />
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
  }
}
