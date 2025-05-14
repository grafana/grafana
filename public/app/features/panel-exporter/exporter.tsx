import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { connect, ConnectedProps, Provider } from 'react-redux';
import ReactDOM from 'react-dom';

import config, { updateConfig } from 'app/core/config';

import { BackendSrv, getBackendSrv, backendSrv } from 'app/core/services/backend_srv';
import { locationService, setDataSourceSrv, setBackendSrv, setLocationSrv } from '@grafana/runtime';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { GrafanaBootConfig } from '@grafana/runtime/src/config';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardPanel } from 'app/features/dashboard/dashgrid/DashboardPanel';
import { KeybindingSrv } from 'app/core/services/keybindingSrv';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService'
import { NewFrontendAssetsChecker } from 'app/core/services/NewFrontendAssetsChecker';
import { DashboardSrv, setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { initDashboard } from 'app/features/dashboard/state/initDashboard';
import { DashboardDTO, DashboardRoutes } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { initializeI18n } from 'app/core/internationalization';
import { RouteDescriptor } from 'app/core/navigation/types';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { Alert, Box, Spinner, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { runRequest } from 'app/features/query/state/runRequest';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';
import { setRunRequest, setPluginImportUtils, setAppEvents } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { useParams } from 'react-router-dom-v5-compat';
export interface SoloProps extends GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string, height:number, width:number }> {}
import { useSoloPanel } from 'app/features/dashboard-scene/solo/useSoloPanel';
import { css } from '@emotion/css';

// in this context, we'll be getting the config asynchronously.
// Normally, window.grafanaBootData is set in index.html and
// the 'config' system relies upon this synchronicity. Here,
// we'll manually instantiate it instead.
function getConfig(){
  function checkAndResolveLater(resolve:any, reject:any, timeout:any){
    if(timeout > 3000){ reject('Application did not load in time!') }
    let bootData = (window as any).grafanaBootData;
    if(!!bootData){
      const options = bootData.settings;
      options.bootData = bootData;

      const conf = new GrafanaBootConfig(options);
      resolve(conf);
    } else {
      window.setTimeout(()=>{
        checkAndResolveLater(resolve, reject, timeout + 100)
      }, timeout);
    }
  }

  return new Promise((resolve, reject)=>{
    checkAndResolveLater(resolve, reject, 100);
  })

}

interface AppContext {
  store: any,
  backend: any,
  location: any,
  config: any,
  chrome: any,
  keybindings: any,
  newAssetsChecker: any
}

const GrafContext: any = async function(dashboardUid:string){
  let conf = await getConfig()

  if(GrafContext._appContext){
    return GrafContext._appContext;
  }

  // 'new' async update for the config!
  //updateConfig(conf);
  for(let key in conf){
    config[key] = conf[key];
  }

  const initI18nPromise = initializeI18n(config.bootData.user.language);
  initI18nPromise.then(({ language }) => updateConfig({ language }));
  // NB: how does 'setBackendSrv' etc work? After looking at them
  // they're a singleton pattern that writes into the in-memory module namespace.

  // cribbed from /public/app/app.ts#L130
  setBackendSrv(backendSrv);
  // cribbed from /public/app/app.ts#145
  setLocationSrv(locationService);
  // cribbed from /public/app/app.ts#203
  const dataSourceSrv = new DatasourceSrv();
  dataSourceSrv.init(conf.datasources, conf.defaultDatasource);
  setDataSourceSrv(dataSourceSrv);

  await initI18nPromise;
  // cribbed from /public/app/app.ts#230
  const chromeService = new AppChromeService();
  // cribbed from /public/app/app.ts#231
  const keybindingService = new KeybindingSrv(locationService, chromeService);
  // cribbed from /public/app/app.ts#232-3. very likely this is nonsense we want to override/mock
  const newAssetsChecker = new NewFrontendAssetsChecker();
  newAssetsChecker.start();
  // more cribs form /public/app/app.ts
  const dashboardSrv = new DashboardSrv();
  setDashboardSrv(dashboardSrv);
  // force API URL fetcher not to append weird random dashboard state junk to initial URL
  locationService.push("/");
  // API Call has best security feels. Most likely to be approved by sec/legal
  const store = configureStore();
  try {
    setRunRequest(runRequest);
    setPluginImportUtils({
      importPanelPlugin,
      getPanelPluginFromCache: syncGetPanelPlugin,
    });
  } catch(e) {
    console.log(e);
  }
  setAppEvents(appEvents);
  // cribbed from /public/app/app.ts#L245
  GrafContext._appContext =  {
      backend: backendSrv,
      location: locationService,
      chrome: chromeService,
      keybindings: keybindingService,
      store: store,
      newAssetsChecker,
      conf,
  };
  return GrafContext._appContext;
};

const getStyles = (height: number, width: number) => { 
  return (theme: GrafanaTheme2)=>{
    return ({
      container: css({
        width: `${width}px`,
        height: `${height}px`,
      })
    })
  }
};

export function PanelRenderer({ dashboard, panelId, height, width }: { dashboard: DashboardScene; panelId: string, height: number, width: number }) {
  const [panel, error] = useSoloPanel(dashboard, panelId);
  const { controls } = dashboard.useState();
  const refreshPicker = controls?.useState()?.refreshPicker;
  const styles = useStyles2(getStyles(height, width));

  React.useEffect(() => {
    return refreshPicker?.activate();
  }, [refreshPicker]);

  if (error) {
    return <Alert title={error} />;
  }

  if (!panel) {
    return (
      <span>
        Loading <Spinner />
      </span>
    );
  }

  return (
    <div className={styles.container}>
      <panel.Component model={panel} />
    </div>
  );
}

export function PanelExporter({ queryParams, uid, height, width }: SoloProps) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, loadError } = stateManager.useState();
  const { type, slug } = useParams();

  React.useEffect(() => {
    stateManager.loadDashboard({ uid, type, slug, route: DashboardRoutes.Embedded });
    return () => stateManager.clearState();
  }, [stateManager, queryParams, uid, type, slug]);

  if (!queryParams.panelId) {
    return <EntityNotFound entity="Panel" />;
  }

  if (loadError) {
    return (
      <Box justifyContent={'center'} alignItems={'center'} display={'flex'} height={'100%'}>
        <Alert severity="error" title={t('dashboard.errors.failed-to-load', 'Failed to load dashboard')}>
          {loadError.message}
        </Alert>
      </Box>
    );
  }

  if (!dashboard) {
    return <PageLoader />;
  }

  return (
      <PanelRenderer dashboard={dashboard} panelId={queryParams.panelId} />
  );
}

let bindToElementId = async function(appContext: AppContext, dashboardUid: string, panelId: number, elementId: string, height: number, width: number){
  let panelElem = await getPanel(appContext, dashboardUid, panelId, height, width);
  let rootElem = document.getElementById(elementId);
  if(!rootElem || !panelElem) return
  let root = createRoot(rootElem);
  root.render(panelElem);
}

// this should very likely be changed back over to the createRoot syntax
let bindToElement = async function(appContext: AppContext, dashboardUid: string, panelId: number, element: HTMLElement, height: number, width: number){
  let panelElem = await getPanel(appContext, dashboardUid, panelId, height, width);
  if(!panelElem) return
  ReactDOM.render(panelElem, element);
}

function getPanel(appContext: AppContext, dashboardUid:string, panelId:number, height: number, width: number){
  let props: Props = {
    initDashboard: initDashboard,
    dashboard: null,
    panel: null,
    match: {params: { slug: 'my-dash', uid: dashboardUid }},
    route: { routeName: DashboardRoutes.Normal } as RouteDescriptor,
    panelId: panelId,
    queryParams: { panelId: panelId },
    uid: dashboardUid,
    height: height,
    width: width,
  }
  return <Provider store={appContext.store}>
    <GrafanaContext.Provider value={appContext}>
      <PanelExporter {...props}></PanelExporter>
    </GrafanaContext.Provider>
  </Provider>
}

export const bindPanelToElement = bindToElement;
export const bindPanelToElementId = bindToElementId;
export const Context = GrafContext;