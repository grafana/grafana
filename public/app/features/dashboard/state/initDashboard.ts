// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { AnnotationsSrv } from 'app/features/annotations/annotations_srv';
import { VariableSrv } from 'app/features/templating/variable_srv';
import { KeybindingSrv } from 'app/core/services/keybindingSrv';
import { config } from 'app/core/config';

// Actions
import { updateLocation } from 'app/core/actions';
import { notifyApp } from 'app/core/actions';
import locationUtil from 'app/core/utils/location_util';
import { setDashboardLoadingState, ThunkResult, setDashboardModel } from './actions';
import { removePanel } from '../utils/panel';

// Types
import { DashboardLoadingState, DashboardRouteInfo } from 'app/types';
import { DashboardModel } from './DashboardModel';

export interface InitDashboardArgs {
  $injector: any;
  $scope: any;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  urlFolderId?: string;
  routeInfo: string;
  fixUrl: boolean;
}

async function redirectToNewUrl(slug: string, dispatch: any, currentPath: string) {
  const res = await getBackendSrv().getDashboardBySlug(slug);

  if (res) {
    let newUrl = res.meta.url;

    // fix solo route urls
    if (currentPath.indexOf('dashboard-solo') !== -1) {
      newUrl = newUrl.replace('/d/', '/d-solo/');
    }

    const url = locationUtil.stripBaseFromUrl(newUrl);
    dispatch(updateLocation({ path: url, partial: true, replace: true }));
  }
}

/**
 * This action (or saga) does everything needed to bootstrap a dashboard & dashboard model.
 * First it handles the process of fetching the dashboard, correcting the url if required (causing redirects/url updates)
 *
 * This is used both for single dashboard & solo panel routes, home & new dashboard routes.
 *
 * Then it handles the initializing of the old angular services that the dashboard components & panels still depend on
 *
 */
export function initDashboard({
  $injector,
  $scope,
  urlUid,
  urlSlug,
  urlType,
  urlFolderId,
  routeInfo,
  fixUrl,
}: InitDashboardArgs): ThunkResult<void> {
  return async (dispatch, getState) => {
    let dashDTO = null;

    // set fetching state
    dispatch(setDashboardLoadingState(DashboardLoadingState.Fetching));

    try {
      switch (routeInfo) {
        // handle old urls with no uid
        case DashboardRouteInfo.Home: {
          // load home dash
          dashDTO = await getBackendSrv().get('/api/dashboards/home');

          // if user specified a custom home dashboard redirect to that
          if (dashDTO.redirectUri) {
            const newUrl = locationUtil.stripBaseFromUrl(dashDTO.redirectUri);
            dispatch(updateLocation({ path: newUrl, replace: true }));
            return;
          }

          // disable some actions on the default home dashboard
          dashDTO.meta.canSave = false;
          dashDTO.meta.canShare = false;
          dashDTO.meta.canStar = false;
          break;
        }
        case DashboardRouteInfo.Normal: {
          // for old db routes we redirect
          if (urlType === 'db') {
            redirectToNewUrl(urlSlug, dispatch, getState().location.path);
            return;
          }

          const loaderSrv = $injector.get('dashboardLoaderSrv');
          dashDTO = await loaderSrv.loadDashboard(urlType, urlSlug, urlUid);

          if (fixUrl && dashDTO.meta.url) {
            // check if the current url is correct (might be old slug)
            const dashboardUrl = locationUtil.stripBaseFromUrl(dashDTO.meta.url);
            const currentPath = getState().location.path;

            if (dashboardUrl !== currentPath) {
              // replace url to not create additional history items and then return so that initDashboard below isn't executed multiple times.
              dispatch(updateLocation({ path: dashboardUrl, partial: true, replace: true }));
              return;
            }
          }

          break;
        }
        case DashboardRouteInfo.New: {
          dashDTO = getNewDashboardModelData(urlFolderId);
          break;
        }
      }
    } catch (err) {
      dispatch(setDashboardLoadingState(DashboardLoadingState.Error));
      console.log(err);
      return;
    }

    // set initializing state
    dispatch(setDashboardLoadingState(DashboardLoadingState.Initializing));

    // create model
    let dashboard: DashboardModel;
    try {
      dashboard = new DashboardModel(dashDTO.dashboard, dashDTO.meta);
    } catch (err) {
      dispatch(setDashboardLoadingState(DashboardLoadingState.Error));
      console.log(err);
      return;
    }

    // add missing orgId query param
    if (!getState().location.query.orgId) {
      dispatch(updateLocation({ query: { orgId: config.bootData.user.orgId }, partial: true, replace: true }));
    }

    // init services
    const timeSrv: TimeSrv = $injector.get('timeSrv');
    const annotationsSrv: AnnotationsSrv = $injector.get('annotationsSrv');
    const variableSrv: VariableSrv = $injector.get('variableSrv');
    const keybindingSrv: KeybindingSrv = $injector.get('keybindingSrv');
    const unsavedChangesSrv = $injector.get('unsavedChangesSrv');
    const dashboardSrv: DashboardSrv = $injector.get('dashboardSrv');

    timeSrv.init(dashboard);
    annotationsSrv.init(dashboard);

    // template values service needs to initialize completely before
    // the rest of the dashboard can load
    try {
      await variableSrv.init(dashboard);
    } catch (err) {
      dispatch(notifyApp(createErrorNotification('Templating init failed')));
      console.log(err);
    }

    try {
      dashboard.processRepeats();
      dashboard.updateSubmenuVisibility();

      // handle auto fix experimental feature
      const queryParams = getState().location.query;
      if (queryParams.autofitpanels) {
        dashboard.autoFitPanels(window.innerHeight, queryParams.kiosk);
      }

      // init unsaved changes tracking
      unsavedChangesSrv.init(dashboard, $scope);

      // dashboard keybindings should not live in core, this needs a bigger refactoring
      // So declaring this here so it can depend on the removePanel util function
      // Long term onRemovePanel should be handled via react prop callback
      const onRemovePanel = (panelId: number) => {
        removePanel(dashboard, dashboard.getPanelById(panelId), true);
      };

      keybindingSrv.setupDashboardBindings($scope, dashboard, onRemovePanel);
    } catch (err) {
      dispatch(notifyApp(createErrorNotification('Dashboard init failed', err.toString())));
      console.log(err);
    }

    // legacy srv state
    dashboardSrv.setCurrent(dashboard);
    // set model in redux (even though it's mutable)
    dispatch(setDashboardModel(dashboard));
  };
}

function getNewDashboardModelData(urlFolderId?: string): any {
  const data = {
    meta: {
      canStar: false,
      canShare: false,
      isNew: true,
      folderId: 0,
    },
    dashboard: {
      title: 'New dashboard',
      panels: [
        {
          type: 'add-panel',
          gridPos: { x: 0, y: 0, w: 12, h: 9 },
          title: 'Panel Title',
        },
      ],
    },
  };

  if (urlFolderId) {
    data.meta.folderId = parseInt(urlFolderId, 10);
  }

  return data;
}
