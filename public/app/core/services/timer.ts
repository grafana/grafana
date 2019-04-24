import _ from 'lodash';
import coreModule from 'app/core/core_module';

// This service really just tracks a list of $timeout promises to give us a
// method for canceling them all when we need to
export class Timer {
  timers = [];

  /** @ngInject */
  constructor(private $timeout) {}

  register(promise) {
    this.timers.push(promise);
    return promise;
  }

  cancel(promise) {
    this.timers = _.without(this.timers, promise);
    this.$timeout.cancel(promise);
  }

  cancelAll() {
    _.each(this.timers, t => {
      this.$timeout.cancel(t);
    });
    this.timers = [];
  }
}

coreModule.service('timer', Timer);
