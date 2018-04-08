import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { store } from 'app/stores/store';
import { reaction } from 'mobx';
import locationUtil from 'app/core/utils/location_util';

// Services that handles angular -> mobx store sync & other react <-> angular sync
export class BridgeSrv {
  private fullPageReloadRoutes;

  /** @ngInject */
  constructor(private $location, private $timeout, private $window, private $rootScope, private $route) {
    this.fullPageReloadRoutes = ['/logout'];
  }

  init() {
    this.$rootScope.$on('$routeUpdate', (evt, data) => {
      let angularUrl = this.$location.url();
      if (store.view.currentUrl !== angularUrl) {
        store.view.updatePathAndQuery(this.$location.path(), this.$location.search(), this.$route.current.params);
      }
    });

    this.$rootScope.$on('$routeChangeSuccess', (evt, data) => {
      store.view.updatePathAndQuery(this.$location.path(), this.$location.search(), this.$route.current.params);
    });

    reaction(
      () => store.view.currentUrl,
      currentUrl => {
        let angularUrl = this.$location.url();
        const url = locationUtil.stripBaseFromUrl(currentUrl);
        if (angularUrl !== url) {
          this.$timeout(() => {
            this.$location.url(url);
          });
          console.log('store updating angular $location.url', url);
        }
      }
    );

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
