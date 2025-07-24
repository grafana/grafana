import { ComponentType, ReactNode } from 'react';
import { Router } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';

import { locationService, LocationServiceProvider } from '@grafana/runtime';
import { ModalRoot, Stack } from '@grafana/ui';

import { AppChrome } from '../core/components/AppChrome/AppChrome';
import { AppChromeExtensionPoint } from '../core/components/AppChrome/AppChromeExtensionPoint';
import { AppNotificationList } from '../core/components/AppNotifications/AppNotificationList';
import { ModalsContextProvider } from '../core/context/ModalsContextProvider';
import { QueriesDrawerContextProvider } from '../features/explore/QueriesDrawer/QueriesDrawerContext';

function ExtraProviders(props: { children: ReactNode; providers: Array<ComponentType<{ children: ReactNode }>> }) {
  return props.providers.reduce((tree, Provider): ReactNode => {
    return <Provider>{tree}</Provider>;
  }, props.children);
}

type RouterWrapperProps = {
  routes?: JSX.Element | false;
  bodyRenderHooks: ComponentType[];
  pageBanners: ComponentType[];
  providers: Array<ComponentType<{ children: ReactNode }>>;
};
export function RouterWrapper(props: RouterWrapperProps) {
  return (
    <Router history={locationService.getHistory()}>
      <LocationServiceProvider service={locationService}>
        <CompatRouter>
          <QueriesDrawerContextProvider>
            <ExtraProviders providers={props.providers}>
              <ModalsContextProvider>
                <AppChrome>
                  <AppNotificationList />
                  <Stack gap={0} grow={1} direction="column">
                    {props.pageBanners.map((Banner, index) => (
                      <Banner key={index.toString()} />
                    ))}
                    {props.routes}
                  </Stack>
                  {props.bodyRenderHooks.map((Hook, index) => (
                    <Hook key={index.toString()} />
                  ))}
                  <AppChromeExtensionPoint />
                </AppChrome>
                <ModalRoot />
              </ModalsContextProvider>
            </ExtraProviders>
          </QueriesDrawerContextProvider>
        </CompatRouter>
      </LocationServiceProvider>
    </Router>
  );
}
