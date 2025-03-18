import { DataQuery, locationUtil, setWeekStart, DashboardLoadedEvent } from '@grafana/data';
import { config, isFetchError, locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import appEvents from 'app/core/app_events';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { backendSrv } from 'app/core/services/backend_srv';
import { KeybindingSrv } from 'app/core/services/keybindingSrv';
import store from 'app/core/store';
import { startMeasure, stopMeasure } from 'app/core/utils/metrics';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DashboardSrv, getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import {
  HOME_DASHBOARD_CACHE_KEY,
  getDashboardScenePageStateManager,
} from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { buildNewDashboardSaveModel } from 'app/features/dashboard-scene/serialization/buildNewDashboardSaveModel';
import { getFolderByUid } from 'app/features/folders/state/actions';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { toStateKey } from 'app/features/variables/utils';
import {
  DASHBOARD_FROM_LS_KEY,
  DashboardDTO,
  DashboardInitPhase,
  DashboardRoutes,
  StoreState,
  ThunkDispatch,
  ThunkResult,
} from 'app/types';

import { createDashboardQueryRunner } from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';
import { initVariablesTransaction } from '../../variables/state/actions';
import { getIfExistsLastKey } from '../../variables/state/selectors';
import { trackDashboardLoaded } from '../utils/tracking';

import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';
import { emitDashboardViewEvent } from './analyticsProcessor';
import { dashboardInitCompleted, dashboardInitFailed, dashboardInitFetching, dashboardInitServices } from './reducers';

const INIT_DASHBOARD_MEASUREMENT = 'initDashboard';

export interface InitDashboardArgs {
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  urlFolderUid?: string;
  panelType?: string;
  accessToken?: string;
  routeName?: string;
  fixUrl: boolean;
  keybindingSrv: KeybindingSrv;
}

async function fetchDashboard(
  args: InitDashboardArgs,
  dispatch: ThunkDispatch,
  getState: () => StoreState
): Promise<DashboardDTO | null> {
  try {
    switch (args.routeName) {
      case DashboardRoutes.Home: {
        const stateManager = getDashboardScenePageStateManager();
        const cachedDashboard = stateManager.getDashboardFromCache(HOME_DASHBOARD_CACHE_KEY);

        if (cachedDashboard) {
          return cachedDashboard;
        }

        // load home dash
        const dashDTO: DashboardDTO = await backendSrv.get('/api/dashboards/home');

        // if user specified a custom home dashboard redirect to that
        if (dashDTO.redirectUri) {
          const newUrl = locationUtil.stripBaseFromUrl(dashDTO.redirectUri);
          locationService.replace(newUrl);
          return null;
        }

        // disable some actions on the default home dashboard
        dashDTO.meta.canSave = false;
        dashDTO.meta.canShare = false;
        dashDTO.meta.canStar = false;
        return dashDTO;
      }
      case DashboardRoutes.Public: {
        return await dashboardLoaderSrv.loadDashboard('public', args.urlSlug, args.accessToken);
      }
      case DashboardRoutes.Normal: {
        const dashDTO: DashboardDTO = await dashboardLoaderSrv.loadDashboard(args.urlType, args.urlSlug, args.urlUid);

        // only the folder API has information about ancestors
        // get parent folder (if it exists) and put it in the store
        // this will be used to populate the full breadcrumb trail
        if (dashDTO.meta.folderUid) {
          try {
            await dispatch(getFolderByUid(dashDTO.meta.folderUid));
          } catch (err) {
            console.warn('Error fetching parent folder', dashDTO.meta.folderUid, 'for dashboard', err);
          }
        }

        if (args.fixUrl && dashDTO.meta.url && !playlistSrv.state.isPlaying) {
          // check if the current url is correct (might be old slug)
          const dashboardUrl = locationUtil.stripBaseFromUrl(dashDTO.meta.url);
          const currentPath = locationService.getLocation().pathname;

          if (dashboardUrl !== currentPath) {
            // Spread current location to persist search params used for navigation
            locationService.replace({
              ...locationService.getLocation(),
              pathname: dashboardUrl,
            });
            console.log('not correct url correcting', dashboardUrl, currentPath);
          }
        }
        return dashDTO;
      }
      case DashboardRoutes.New: {
        // only the folder API has information about ancestors
        // get parent folder (if it exists) and put it in the store
        // this will be used to populate the full breadcrumb trail
        if (args.urlFolderUid) {
          await dispatch(getFolderByUid(args.urlFolderUid));
        }
        return await buildNewDashboardSaveModel(args.urlFolderUid);
      }
      default:
        throw { message: 'Unknown route ' + args.routeName };
    }
  } catch (err) {
    // Ignore cancelled errors
    if (isFetchError(err) && err.cancelled) {
      return null;
    }

    dispatch(dashboardInitFailed({ message: 'Failed to fetch dashboard', error: err }));
    console.error(err);
    return null;
  }
}

const getQueriesByDatasource = (
  panels: PanelModel[],
  queries: { [datasourceId: string]: DataQuery[] } = {}
): { [datasourceId: string]: DataQuery[] } => {
  panels.forEach((panel) => {
    if (panel.panels) {
      getQueriesByDatasource(panel.panels, queries);
    } else if (panel.targets) {
      panel.targets.forEach((target) => {
        if (target.datasource?.type) {
          if (queries[target.datasource.type]) {
            queries[target.datasource.type].push(target);
          } else {
            queries[target.datasource.type] = [target];
          }
        }
      });
    }
  });
  return queries;
};

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
    startMeasure(INIT_DASHBOARD_MEASUREMENT);

    // set fetching state
    dispatch(dashboardInitFetching());

    // fetch dashboard data
    const dashDTO = await fetchDashboard(args, dispatch, getState);
    const versionBeforeMigration = dashDTO?.dashboard?.version;

    // returns null if there was a redirect or error
    if (!dashDTO) {
      return;
    }

    addPanelsFromLocalStorage(dashDTO);

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
    const queryParams = locationService.getSearchObject();

    if (!queryParams.orgId) {
      // TODO this is currently not possible with the LocationService API
      locationService.partial({ orgId: storeState.user.orgId }, true);
    }

    // init services
    const timeSrv: TimeSrv = getTimeSrv();
    const dashboardSrv: DashboardSrv = getDashboardSrv();

    // legacy srv state, we need this value updated for built-in annotations
    dashboardSrv.setCurrent(dashboard);

    timeSrv.init(dashboard);

    const dashboardUid = toStateKey(args.urlUid ?? dashboard.uid);
    // template values service needs to initialize completely before the rest of the dashboard can load
    await dispatch(initVariablesTransaction(dashboardUid, dashboard));

    // DashboardQueryRunner needs to run after all variables have been resolved so that any annotation query including a variable
    // will be correctly resolved
    const runner = createDashboardQueryRunner({ dashboard, timeSrv });
    runner.run({ dashboard, range: timeSrv.timeRange() });

    if (getIfExistsLastKey(getState()) !== dashboardUid) {
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

      // handle auto fix experimental feature
      if (queryParams.autofitpanels) {
        dashboard.autoFitPanels(window.innerHeight, queryParams.kiosk);
      }

      if (!config.publicDashboardAccessToken) {
        args.keybindingSrv.setupDashboardBindings(dashboard);
      }
    } catch (err) {
      if (err instanceof Error) {
        dispatch(notifyApp(createErrorNotification('Dashboard init failed', err)));
      }
      console.error(err);
    }

    // send open dashboard event
    if (args.routeName !== DashboardRoutes.New) {
      emitDashboardViewEvent(dashboard);

      // Listen for changes on the current dashboard
      dashboardWatcher.watch(dashboard.uid);
    } else {
      dashboardWatcher.leave();
    }

    // set week start
    if (dashboard.weekStart !== '') {
      setWeekStart(dashboard.weekStart);
    } else {
      setWeekStart(config.bootData.user.weekStart);
    }

    // Propagate an app-wide event about the dashboard being loaded
    appEvents.publish(
      new DashboardLoadedEvent({
        dashboardId: dashboard.uid,
        orgId: storeState.user.orgId,
        userId: storeState.user.user?.id,
        grafanaVersion: config.buildInfo.version,
        queries: getQueriesByDatasource(dashboard.panels),
      })
    );

    const measure = stopMeasure(INIT_DASHBOARD_MEASUREMENT);
    trackDashboardLoaded(dashboard, measure?.duration, versionBeforeMigration);

    // yay we are done
    dispatch(dashboardInitCompleted(dashboard));
  };
}

function addPanelsFromLocalStorage(model: DashboardDTO) {
  // When creating new or adding panels to a dashboard from explore we load it from local storage
  const fromLS = store.getObject<DashboardDTO>(DASHBOARD_FROM_LS_KEY);
  if (fromLS) {
    if (fromLS.dashboard.panels) {
      model.dashboard.panels = fromLS.dashboard.panels.concat(model.dashboard.panels);
    }

    if (fromLS.dashboard.time) {
      model.dashboard.time = fromLS.dashboard.time;
    }

    store.delete(DASHBOARD_FROM_LS_KEY);
  }
}
