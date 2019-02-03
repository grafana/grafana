// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';

// Actions
import { updateLocation } from 'app/core/actions';
import { notifyApp } from 'app/core/actions';
import locationUtil from 'app/core/utils/location_util';
import { setDashboardLoadingState, ThunkResult, setDashboardModel } from './actions';

// Types
import { DashboardLoadingState } from 'app/types/dashboard';
import { DashboardModel } from './DashboardModel';

export interface InitDashboardArgs {
  injector: any;
  scope: any;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
}

export function initDashboard({ injector, scope, urlUid, urlSlug, urlType }: InitDashboardArgs): ThunkResult<void> {
  return async dispatch => {
    const loaderSrv = injector.get('dashboardLoaderSrv');

    dispatch(setDashboardLoadingState(DashboardLoadingState.Fetching));

    let dashDTO = null;

    try {
      // fetch dashboard from api
      dashDTO = await loaderSrv.loadDashboard(urlType, urlSlug, urlUid);
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
    injector.get('timeSrv').init(dashboard);
    injector.get('annotationsSrv').init(dashboard);

    // template values service needs to initialize completely before
    // the rest of the dashboard can load
    try {
      await injector.get('variableSrv').init(dashboard);
    } catch (err) {
      dispatch(notifyApp(createErrorNotification('Templating init failed', err.toString())));
      console.log(err);
    }

    try {
      dashboard.processRepeats();
      dashboard.updateSubmenuVisibility();
      dashboard.autoFitPanels(window.innerHeight);

      // init unsaved changes tracking
      injector.get('unsavedChangesSrv').init(dashboard, scope);

      scope.dashboard = dashboard;
      injector.get('dashboardViewStateSrv').create(scope);
      injector.get('keybindingSrv').setupDashboardBindings(scope, dashboard);
    } catch (err) {
      dispatch(notifyApp(createErrorNotification('Dashboard init failed', err.toString())));
      console.log(err);
    }

    dispatch(setDashboardModel(dashboard));
  };
}
