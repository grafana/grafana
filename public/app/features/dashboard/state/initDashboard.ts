// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { AnnotationsSrv } from 'app/features/annotations/annotations_srv';
import { KeybindingSrv } from 'app/core/services/keybindingSrv';
// Actions
import { notifyApp, updateLocation } from 'app/core/actions';
import {
  clearDashboardQueriesToUpdateOnLoad,
  dashboardInitCompleted,
  dashboardInitFailed,
  dashboardInitFetching,
  dashboardInitServices,
  dashboardInitSlow,
} from './reducers';
// Types
import {
  DashboardDTO,
  DashboardRouteInfo,
  StoreState,
  ThunkDispatch,
  ThunkResult,
  DashboardInitPhase,
} from 'app/types';
import { DashboardModel } from './DashboardModel';
import { DataQuery, locationUtil } from '@grafana/data';
import { initVariablesTransaction } from '../../variables/state/actions';
import { emitDashboardViewEvent } from './analyticsProcessor';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';

export interface InitDashboardArgs {
  $injector: any;
  $scope: any;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  urlFolderId?: string;
  routeInfo: DashboardRouteInfo;
  fixUrl: boolean;
}

async function redirectToNewUrl(slug: string, dispatch: ThunkDispatch, currentPath: string) {
  const res = await backendSrv.getDashboardBySlug(slug);

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

async function fetchDashboard(
  args: InitDashboardArgs,
  dispatch: ThunkDispatch,
  getState: () => StoreState
): Promise<DashboardDTO | null> {
  try {
    switch (args.routeInfo) {
      case DashboardRouteInfo.Home: {
        // load home dash
        const dashDTO: DashboardDTO = await backendSrv.get('/api/dashboards/home');

        // if user specified a custom home dashboard redirect to that
        if (dashDTO.redirectUri) {
          const newUrl = locationUtil.stripBaseFromUrl(dashDTO.redirectUri);
          dispatch(updateLocation({ path: newUrl, replace: true }));
          return null;
        }

        // disable some actions on the default home dashboard
        dashDTO.meta.canSave = false;
        dashDTO.meta.canShare = false;
        dashDTO.meta.canStar = false;
        return dashDTO;
      }
      case DashboardRouteInfo.Normal: {
        // for old db routes we redirect
        if (args.urlType === 'db') {
          redirectToNewUrl(args.urlSlug!, dispatch, getState().location.path);
          return null;
        }

        const loaderSrv: DashboardLoaderSrv = args.$injector.get('dashboardLoaderSrv');
        const dashDTO: DashboardDTO = await loaderSrv.loadDashboard(args.urlType, args.urlSlug, args.urlUid);

        if (args.fixUrl && dashDTO.meta.url) {
          // check if the current url is correct (might be old slug)
          const dashboardUrl = locationUtil.stripBaseFromUrl(dashDTO.meta.url);
          const currentPath = getState().location.path;

          if (dashboardUrl !== currentPath) {
            // replace url to not create additional history items and then return so that initDashboard below isn't executed multiple times.
            dispatch(updateLocation({ path: dashboardUrl, partial: true, replace: true }));
            return null;
          }
        }
        return dashDTO;
      }
      case DashboardRouteInfo.New: {
        return getNewDashboardModelData(args.urlFolderId);
      }
      default:
        throw { message: 'Unknown route ' + args.routeInfo };
    }
  } catch (err) {
    // Ignore cancelled errors
    if (err.cancelled) {
      return null;
    }

    dispatch(dashboardInitFailed({ message: 'Failed to fetch dashboard', error: err }));
    console.error(err);
    return null;
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
export function initDashboard(args: InitDashboardArgs): ThunkResult<void> {
  return async (dispatch, getState) => {
    // set fetching state
    dispatch(dashboardInitFetching());

    // Detect slow loading / initializing and set state flag
    // This is in order to not show loading indication for fast loading dashboards as it creates blinking/flashing
    setTimeout(() => {
      if (getState().dashboard.getModel() === null) {
        dispatch(dashboardInitSlow());
      }
    }, 500);

    // fetch dashboard data
    const dashDTO = await fetchDashboard(args, dispatch, getState);

    // returns null if there was a redirect or error
    if (!dashDTO) {
      return;
    }

    // set initializing state
    dispatch(dashboardInitServices());

    // create model
    let dashboard: DashboardModel;
    try {
      dashboard = new DashboardModel(dashDTO.dashboard, dashDTO.meta);
    } catch (err) {
      dispatch(dashboardInitFailed({ message: 'Failed create dashboard model', error: err }));
      console.error(err);
      return;
    }

    // add missing orgId query param
    const storeState = getState();
    if (!storeState.location.query.orgId) {
      dispatch(updateLocation({ query: { orgId: storeState.user.orgId }, partial: true, replace: true }));
    }

    // init services
    const timeSrv: TimeSrv = args.$injector.get('timeSrv');
    const annotationsSrv: AnnotationsSrv = args.$injector.get('annotationsSrv');
    const keybindingSrv: KeybindingSrv = args.$injector.get('keybindingSrv');
    const unsavedChangesSrv = args.$injector.get('unsavedChangesSrv');
    const dashboardSrv: DashboardSrv = args.$injector.get('dashboardSrv');

    timeSrv.init(dashboard);
    annotationsSrv.init(dashboard);

    if (storeState.dashboard.modifiedQueries) {
      const { panelId, queries } = storeState.dashboard.modifiedQueries;
      dashboard.meta.fromExplore = !!(panelId && queries);
    }

    // template values service needs to initialize completely before the rest of the dashboard can load
    await dispatch(initVariablesTransaction(args.urlUid!, dashboard));

    if (getState().templating.transaction.uid !== args.urlUid) {
      // if a previous dashboard has slow running variable queries the batch uid will be the new one
      // but the args.urlUid will be the same as before initVariablesTransaction was called so then we can't continue initializing
      // the previous dashboard.
      return;
    }

    // If dashboard is in a different init phase it means it cancelled during service init
    if (getState().dashboard.initPhase !== DashboardInitPhase.Services) {
      return;
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
      unsavedChangesSrv.init(dashboard, args.$scope);
      keybindingSrv.setupDashboardBindings(args.$scope, dashboard);
    } catch (err) {
      dispatch(notifyApp(createErrorNotification('Dashboard init failed', err)));
      console.error(err);
    }

    if (storeState.dashboard.modifiedQueries) {
      const { panelId, queries } = storeState.dashboard.modifiedQueries;
      updateQueriesWhenComingFromExplore(dispatch, dashboard, panelId, queries);
    }

    // legacy srv state
    dashboardSrv.setCurrent(dashboard);

    // send open dashboard event
    if (args.routeInfo !== DashboardRouteInfo.New) {
      emitDashboardViewEvent(dashboard);

      // Listen for changes on the current dashboard
      dashboardWatcher.watch(dashboard.uid);
    } else {
      dashboardWatcher.leave();
    }

    // yay we are done
    dispatch(dashboardInitCompleted(dashboard));
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

function updateQueriesWhenComingFromExplore(
  dispatch: ThunkDispatch,
  dashboard: DashboardModel,
  originPanelId: number,
  queries: DataQuery[]
) {
  const panelArrId = dashboard.panels.findIndex(panel => panel.id === originPanelId);

  if (panelArrId > -1) {
    dashboard.panels[panelArrId].targets = queries;
  }

  // Clear update state now that we're done
  dispatch(clearDashboardQueriesToUpdateOnLoad());
}
