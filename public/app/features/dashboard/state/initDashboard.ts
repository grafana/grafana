// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getBackendSrv } from 'app/core/services/backend_srv';

// Actions
import { updateLocation } from 'app/core/actions';
import { notifyApp } from 'app/core/actions';
import locationUtil from 'app/core/utils/location_util';
import { setDashboardLoadingState, ThunkResult, setDashboardModel } from './actions';

// Types
import { DashboardLoadingState } from 'app/types/dashboard';
import { DashboardModel } from './DashboardModel';

export interface InitDashboardArgs {
  $injector: any;
  $scope: any;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
}

async function redirectToNewUrl(slug: string, dispatch: any) {
  const res = await getBackendSrv().getDashboardBySlug(slug);

  if (res) {
    const url = locationUtil.stripBaseFromUrl(res.meta.url.replace('/d/', '/d-solo/'));
    dispatch(updateLocation(url));
  }
}

export function initDashboard({ $injector, $scope, urlUid, urlSlug, urlType }: InitDashboardArgs): ThunkResult<void> {
  return async dispatch => {
    // handle old urls with no uid
    if (!urlUid && urlSlug) {
      redirectToNewUrl(urlSlug, dispatch);
      return;
    }

    let dashDTO = null;

    // set fetching state
    dispatch(setDashboardLoadingState(DashboardLoadingState.Fetching));

    try {
      // if no uid or slug, load home dashboard
      if (!urlUid && !urlSlug) {
        dashDTO = await getBackendSrv().get('/api/dashboards/home');

        if (dashDTO.redirectUri) {
          const newUrl = locationUtil.stripBaseFromUrl(dashDTO.redirectUri);
          dispatch(updateLocation({ path: newUrl }));
          return;
        } else {
          dashDTO.meta.canSave = false;
          dashDTO.meta.canShare = false;
          dashDTO.meta.canStar = false;
        }
      } else {
        const loaderSrv = $injector.get('dashboardLoaderSrv');
        dashDTO = await loaderSrv.loadDashboard(urlType, urlSlug, urlUid);
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

    // init services
    $injector.get('timeSrv').init(dashboard);
    $injector.get('annotationsSrv').init(dashboard);

    // template values service needs to initialize completely before
    // the rest of the dashboard can load
    try {
      await $injector.get('variableSrv').init(dashboard);
    } catch (err) {
      dispatch(notifyApp(createErrorNotification('Templating init failed')));
      console.log(err);
    }

    try {
      dashboard.processRepeats();
      dashboard.updateSubmenuVisibility();
      dashboard.autoFitPanels(window.innerHeight);

      // init unsaved changes tracking
      $injector.get('unsavedChangesSrv').init(dashboard, $scope);

      $scope.dashboard = dashboard;
      $injector.get('dashboardViewStateSrv').create($scope);
      $injector.get('keybindingSrv').setupDashboardBindings($scope, dashboard);
    } catch (err) {
      dispatch(notifyApp(createErrorNotification('Dashboard init failed', err.toString())));
      console.log(err);
    }

    dispatch(setDashboardModel(dashboard));
  };
}
