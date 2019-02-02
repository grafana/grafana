// Libaries
import { StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';

// Services & Utils
import { getBackendSrv } from 'app/core/services/backend_srv';
import { createErrorNotification } from 'app/core/copy/appNotification';

// Actions
import { updateLocation } from 'app/core/actions';
import { notifyApp } from 'app/core/actions';
import locationUtil from 'app/core/utils/location_util';
import { setDashboardLoadingState, ThunkResult } from './actions';

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

    try {
      // fetch dashboard from api
      const dashDTO = await loaderSrv.loadDashboard(urlType, urlSlug, urlUid);
      // set initializing state
      dispatch(setDashboardLoadingState(DashboardLoadingState.Initializing));
      // create model
      const dashboard = new DashboardModel(dashDTO.dashboard, dashDTO.meta);
      // init services

      injector.get('timeSrv').init(dashboard);
      injector.get('annotationsSrv').init(dashboard);

      // template values service needs to initialize completely before
      // the rest of the dashboard can load
      injector.get('variableSrv').init(dashboard)
        .catch(err => {
          dispatch(notifyApp(createErrorNotification('Templating init failed')));
        })
        .finally(() => {

          dashboard.processRepeats();
          dashboard.updateSubmenuVisibility();
          dashboard.autoFitPanels(window.innerHeight);

          injector.get('unsavedChangesSrv').init(dashboard, scope);

          scope.dashboard = dashboard;
          injector.get('dashboardViewStateSrv').create(scope);
          injector.get('keybindingSrv').setupDashboardBindings(scope, dashboard);
        })
        .catch(err => {
          dispatch(setDashboardLoadingState(DashboardLoadingState.Error));
        });
    } catch (err) {
      dispatch(setDashboardLoadingState(DashboardLoadingState.Error));
    }
  };
}
