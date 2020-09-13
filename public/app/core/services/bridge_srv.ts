import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { dispatch, store } from 'app/store/store';
import { updateLocation } from 'app/core/actions';
import { ILocationService, ITimeoutService, IWindowService } from 'angular';
import { CoreEvents } from 'app/types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { locationUtil, UrlQueryMap } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { templateVarsChangedInUrl } from 'app/features/variables/state/actions';
import { isArray, isEqual } from 'lodash';

// Services that handles angular -> redux store sync & other react <-> angular sync
export class BridgeSrv {
  private fullPageReloadRoutes: string[];
  private lastQuery: UrlQueryMap = {};
  private lastPath = '';
  private angularUrl: string;
  private lastUrl: string | null = null;

  /** @ngInject */
  constructor(
    private $location: ILocationService,
    private $timeout: ITimeoutService,
    private $window: IWindowService,
    private $rootScope: GrafanaRootScope,
    private $route: any
  ) {
    this.fullPageReloadRoutes = ['/logout'];
    this.angularUrl = $location.url();
  }

  init() {
    this.$rootScope.$on('$routeUpdate', (evt, data) => {
      const state = store.getState();

      this.angularUrl = this.$location.url();

      if (state.location.url !== this.angularUrl) {
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
      this.angularUrl = this.$location.url();

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
      const url = state.location.url;

      // No url change ignore redux store change
      if (url === this.lastUrl) {
        return;
      }

      if (this.angularUrl !== url) {
        // store angular url right away as otherwise we end up syncing multiple times
        this.angularUrl = url;

        this.$timeout(() => {
          this.$location.url(url);
          // some state changes should not trigger new browser history
          if (state.location.replace) {
            this.$location.replace();
          }
        });
      }

      // if only query params changed, check if variables changed
      if (state.location.path === this.lastPath && state.location.query !== this.lastQuery) {
        // Find template variable changes
        const changes = findTemplateVarChanges(state.location.query, this.lastQuery);
        // Store current query params to avoid recursion
        this.lastQuery = state.location.query;

        if (changes) {
          const dash = getDashboardSrv().getCurrent();
          if (dash) {
            dispatch(templateVarsChangedInUrl(changes));
          }
        }
      }

      this.lastPath = state.location.path;
      this.lastQuery = state.location.query;
      this.lastUrl = state.location.url;
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

function getUrlValueForComparison(value: any): any {
  if (isArray(value)) {
    if (value.length === 0) {
      value = undefined;
    } else if (value.length === 1) {
      value = value[0];
    }
  }

  return value;
}

export function findTemplateVarChanges(query: UrlQueryMap, old: UrlQueryMap): UrlQueryMap | undefined {
  let count = 0;
  const changes: UrlQueryMap = {};

  for (const key in query) {
    if (!key.startsWith('var-')) {
      continue;
    }

    let oldValue = getUrlValueForComparison(old[key]);
    let newValue = getUrlValueForComparison(query[key]);

    if (!isEqual(newValue, oldValue)) {
      changes[key] = query[key];
      count++;
    }
  }

  for (const key in old) {
    if (!key.startsWith('var-')) {
      continue;
    }

    const value = old[key];

    // ignore empty array values
    if (isArray(value) && value.length === 0) {
      continue;
    }

    if (!query.hasOwnProperty(key)) {
      changes[key] = ''; // removed
      count++;
    }
  }
  return count ? changes : undefined;
}

coreModule.service('bridgeSrv', BridgeSrv);
