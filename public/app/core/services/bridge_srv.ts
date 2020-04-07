import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { store } from 'app/store/store';
import locationUtil from 'app/core/utils/location_util';
import { updateLocation } from 'app/core/actions';
import { ITimeoutService, ILocationService, IWindowService } from 'angular';
import { CoreEvents } from 'app/types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { UrlQueryMap } from '@grafana/runtime';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { VariableSrv } from 'app/features/templating/all';

// Services that handles angular -> redux store sync & other react <-> angular sync
export class BridgeSrv {
  private fullPageReloadRoutes: string[];
  private lastQuery: UrlQueryMap = {};
  private lastPath = '';

  /** @ngInject */
  constructor(
    private $location: ILocationService,
    private $timeout: ITimeoutService,
    private $window: IWindowService,
    private $rootScope: GrafanaRootScope,
    private $route: any,
    private variableSrv: VariableSrv
  ) {
    this.fullPageReloadRoutes = ['/logout'];
  }

  init() {
    this.$rootScope.$on('$routeUpdate', (evt, data) => {
      const angularUrl = this.$location.url();
      const state = store.getState();
      if (state.location.url !== angularUrl) {
        store.dispatch(
          updateLocation({
            path: this.$location.path(),
            query: this.$location.search(),
            routeParams: this.$route.current.params,
          })
        );
      }
    });

    this.$rootScope.$on('$routeChangeSuccess', (evt, data) => {
      store.dispatch(
        updateLocation({
          path: this.$location.path(),
          query: this.$location.search(),
          routeParams: this.$route.current.params,
        })
      );
    });

    // Listen for changes in redux location -> update angular location
    store.subscribe(() => {
      const state = store.getState();
      const angularUrl = this.$location.url();
      const url = state.location.url;
      if (angularUrl !== url) {
        this.$timeout(() => {
          this.$location.url(url);
          // some state changes should not trigger new browser history
          if (state.location.replace) {
            this.$location.replace();
          }
        });
        console.log('store updating angular $location.url', url);
      }

      // Check for template variable changes on a dashboard
      if (state.location.path === this.lastPath) {
        const changes = findTemplateVarChanges(state.location.query, this.lastQuery);
        if (changes) {
          const dash = getDashboardSrv().getCurrent();
          if (dash) {
            this.variableSrv.templateVarsChangedInUrl(changes);
          }
        }
        this.lastQuery = state.location.query;
      } else {
        this.lastQuery = {};
      }
      this.lastPath = state.location.path;
    });

    appEvents.on(CoreEvents.locationChange, payload => {
      const urlWithoutBase = locationUtil.stripBaseFromUrl(payload.href);
      if (this.fullPageReloadRoutes.indexOf(urlWithoutBase) > -1) {
        this.$window.location.href = payload.href;
        return;
      }

      this.$timeout(() => {
        // A hack to use timeout when we're changing things (in this case the url) from outside of Angular.
        this.$location.url(urlWithoutBase);
      });
    });
  }
}

export function findTemplateVarChanges(query: UrlQueryMap, old: UrlQueryMap): UrlQueryMap | undefined {
  let count = 0;
  const changes: UrlQueryMap = {};
  for (const key in query) {
    if (!key.startsWith('var-')) {
      continue;
    }
    if (query[key] !== old[key]) {
      changes[key] = query[key];
      count++;
    }
  }
  for (const key in old) {
    if (!key.startsWith('var-')) {
      continue;
    }
    if (!query[key]) {
      changes[key] = ''; // removed
      count++;
    }
  }
  return count ? changes : undefined;
}

coreModule.service('bridgeSrv', BridgeSrv);
