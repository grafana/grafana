import { css } from '@emotion/css';
import { ComponentType } from 'react';
// eslint-disable-next-line no-restricted-imports
import { Router } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data/';
import {
  HistoryWrapper,
  locationService,
  LocationServiceProvider,
  useChromeHeaderHeight,
  useSidecar_EXPERIMENTAL,
} from '@grafana/runtime';
import { GlobalStyles, IconButton, ModalRoot, Stack, useSplitter, useStyles2 } from '@grafana/ui';

import { AngularRoot } from '../angular/AngularRoot';
import { AppChrome } from '../core/components/AppChrome/AppChrome';
import { AppNotificationList } from '../core/components/AppNotifications/AppNotificationList';
import { ModalsContextProvider } from '../core/context/ModalsContextProvider';
import { QueriesDrawerContextProvider } from '../features/explore/QueriesDrawer/QueriesDrawerContext';
import AppRootPage from '../features/plugins/components/AppRootPage';

import { createLocationStorageHistory } from './utils';

type RouterWrapperProps = {
  routes?: JSX.Element | false;
  bodyRenderHooks: ComponentType[];
  pageBanners: ComponentType[];
};
export function RouterWrapper(props: RouterWrapperProps) {
  return (
    <Router history={locationService.getHistory()}>
      <LocationServiceProvider service={locationService}>
        <CompatRouter>
          <QueriesDrawerContextProvider>
            <ModalsContextProvider>
              <AppChrome>
                <AngularRoot />
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
              </AppChrome>
              <ModalRoot />
            </ModalsContextProvider>
          </QueriesDrawerContextProvider>
        </CompatRouter>
      </LocationServiceProvider>
    </Router>
  );
}

/**
 * Renders both the main app tree and a secondary sidecar app tree to show 2 apps at the same time in a resizable split
 * view.
 * @param props
 * @constructor
 */
export function ExperimentalSplitPaneRouterWrapper(props: RouterWrapperProps) {
  const { activePluginId, closeApp } = useSidecar_EXPERIMENTAL();

  let { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: 'row',
    initialSize: 0.6,
    dragPosition: 'end',
  });

  // The style changes allow the resizing to be more flexible and not constrained by the content dimensions. In the
  // future this could be a switch in the useSplitter but for now it's here until this feature is more final.
  function alterStyles<T extends { style: React.CSSProperties }>(props: T): T {
    return {
      ...props,
      style: { ...props.style, overflow: 'auto', minWidth: 'unset', minHeight: 'unset' },
    };
  }
  primaryProps = alterStyles(primaryProps);
  secondaryProps = alterStyles(secondaryProps);

  const headerHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, headerHeight);
  const memoryLocationService = new HistoryWrapper(
    createLocationStorageHistory({ storageKey: 'grafana.sidecar.history' })
  );

  return (
    // Why do we need these 2 wrappers here? We want for one app case to render very similar as if there was no split
    // wrapper at all but the split wrapper needs to have these wrappers to attach its container props to. At the same
    // time we don't want to rerender the main app when going from 2 apps render to single app render which would happen
    // if we removed the wrappers. So the solution is to keep those 2 divs but make them no actually do anything in
    // case we are rendering a single app.
    <div {...(activePluginId ? containerProps : { className: styles.dummyWrapper })}>
      <div {...(activePluginId ? primaryProps : { className: styles.dummyWrapper })}>
        <RouterWrapper {...props} />
      </div>
      {/* Sidecar */}
      {activePluginId && (
        <>
          <div {...splitterProps} />
          <div {...secondaryProps}>
            <Router history={memoryLocationService.getHistory()}>
              <LocationServiceProvider service={memoryLocationService}>
                <CompatRouter>
                  <GlobalStyles />
                  <div className={styles.secondAppWrapper}>
                    <div className={styles.secondAppToolbar}>
                      <IconButton
                        size={'lg'}
                        style={{ margin: '8px' }}
                        name={'times'}
                        aria-label={'close'}
                        onClick={() => closeApp(activePluginId)}
                      />
                    </div>
                    <AppRootPage pluginId={activePluginId} />
                  </div>
                </CompatRouter>
              </LocationServiceProvider>
            </Router>
          </div>
        </>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, headerHeight: number | undefined) => {
  return {
    secondAppWrapper: css({
      label: 'secondAppWrapper',
      display: 'flex',
      height: '100%',
      paddingTop: headerHeight || 0,
      flexGrow: 1,
      flexDirection: 'column',
    }),

    secondAppToolbar: css({
      label: 'secondAppToolbar',
      display: 'flex',
      justifyContent: 'flex-end',
    }),

    // This is basically the same as grafana-app class. This means the 2 additional wrapper divs that are in between
    // grafana-app div and the main app component don't actually change anything in the layout.
    dummyWrapper: css({
      label: 'dummyWrapper',
      display: 'flex',
      height: '100vh',
      flexDirection: 'column',
    }),
  };
};
