import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';

// This service is for registering global events.
// Good for communication react > angular and vice verse
export class GlobalEventSrv {
  private appSubUrl;
  private fullPageReloadRoutes;

  /** @ngInject */
  constructor(private $location, private $timeout, private $window) {
    this.appSubUrl = config.appSubUrl;
    this.fullPageReloadRoutes = ['/logout'];
  }

  // Angular's $location does not like <base href...> and absolute urls
  stripBaseFromUrl(url = '') {
    const appSubUrl = this.appSubUrl;
    const stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
    const urlWithoutBase =
      url.length > 0 && url.indexOf(appSubUrl) === 0
        ? url.slice(appSubUrl.length - stripExtraChars)
        : url;

    return urlWithoutBase;
  }

  init() {
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

coreModule.service('globalEventSrv', GlobalEventSrv);
