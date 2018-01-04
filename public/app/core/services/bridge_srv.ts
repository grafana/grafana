import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import { store } from 'app/stores/store';
import { reaction } from 'mobx';

// Services that handles angular -> mobx store sync & other react <-> angular sync
export class BridgeSrv {
  private appSubUrl;
  private fullPageReloadRoutes;

  /** @ngInject */
  constructor(private $location, private $timeout, private $window, private $rootScope) {
    this.appSubUrl = config.appSubUrl;
    this.fullPageReloadRoutes = ['/logout'];
  }

  // Angular's $location does not like <base href...> and absolute urls
  stripBaseFromUrl(url = '') {
    const appSubUrl = this.appSubUrl;
    const stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
    const urlWithoutBase =
      url.length > 0 && url.indexOf(appSubUrl) === 0 ? url.slice(appSubUrl.length - stripExtraChars) : url;

    return urlWithoutBase;
  }

  init() {
    this.$rootScope.$on('$routeUpdate', (evt, data) => {
      let angularUrl = this.$location.url();
      if (store.view.currentUrl !== angularUrl) {
        store.view.updatePathAndQuery(this.$location.path(), this.$location.search());
      }
    });

    this.$rootScope.$on('$routeChangeSuccess', (evt, data) => {
      let angularUrl = this.$location.url();
      if (store.view.currentUrl !== angularUrl) {
        store.view.updatePathAndQuery(this.$location.path(), this.$location.search());
      }
    });

    reaction(
      () => store.view.currentUrl,
      currentUrl => {
        let angularUrl = this.$location.url();
        if (angularUrl !== currentUrl) {
          this.$location.url(currentUrl);
          console.log('store updating angular $location.url', currentUrl);
        }
      }
    );

    appEvents.on('location-change', payload => {
      const urlWithoutBase = this.stripBaseFromUrl(payload.href);
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
