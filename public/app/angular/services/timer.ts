import { ITimeoutService } from 'angular';
import { without, each } from 'lodash';

import coreModule from 'app/angular/core_module';

// This service really just tracks a list of $timeout promises to give us a
// method for canceling them all when we need to
export class Timer {
  timers: Array<angular.IPromise<any>> = [];

  /** @ngInject */
  constructor(private $timeout: ITimeoutService) {}

  register(promise: angular.IPromise<any>) {
    this.timers.push(promise);
    return promise;
  }

  cancel(promise: angular.IPromise<any>) {
    this.timers = without(this.timers, promise);
    this.$timeout.cancel(promise);
  }

  cancelAll() {
    each(this.timers, (t) => {
      this.$timeout.cancel(t);
    });
    this.timers = [];
  }
}

coreModule.service('timer', Timer);
