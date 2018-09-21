import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { store } from 'app/store/configureStore';
import locationUtil from 'app/core/utils/location_util';
import { updateLocation } from 'app/core/actions';

// Services that handles angular -> mobx store sync & other react <-> angular sync
export class BridgeSrv {
  private fullPageReloadRoutes;

  /** @ngInject */
  constructor(private $location, private $timeout, private $window, private $rootScope, private $route) {
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
      const url = locationUtil.stripBaseFromUrl(state.location.url);
      if (angularUrl !== url) {
        this.$timeout(() => {
          this.$location.url(url);
        });
        console.log('store updating angular $location.url', url);
      }
    });

    appEvents.on('location-change', payload => {
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

coreModule.service('bridgeSrv', BridgeSrv);
