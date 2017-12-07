import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

// This service is for registering global events.
// Good for communication react > angular and vice verse
export class GlobalEventSrv {

  /** @ngInject */
  constructor(private $location, private $timeout) {
  }

  init() {
    appEvents.on('location-change', payload => {
        this.$timeout(() => { // A hack to use timeout when we're changing things (in this case the url) from outside of Angular.
            this.$location.path(payload.href);
        });
    });
  }
}

coreModule.service('globalEventSrv', GlobalEventSrv);
