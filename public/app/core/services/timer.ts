import _ from 'lodash';
import coreModule from 'app/core/core_module';
import { ITimeoutService } from 'angular';

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
