///<reference path="../../../headers/common.d.ts" />

import {liveSrv} from 'app/core/core';

import {Observable} from 'vendor/npm/rxjs/Observable';

export class GrafanaStreamDS {
  subscription: any;

  /** @ngInject */
  constructor() {

  }

  query(options) {
    if (options.targets.length === 0) {
      return Promise.resolve({data: []});
    }

    var target = options.targets[0];

    if (this.subscription) {
      if (this.subscription.stream !== target.stream) {
        this.subscription.unsubscribe();
      } else {
        return Promise.resolve({data: []});
      }
    }

    var observable = liveSrv.subscribe(target.stream);

    this.subscription = observable.subscribe(data => {
      console.log("grafana stream ds data!", data);
    });

    this.subscription.stream = target.stream;

    return Promise.resolve({data: []});
  }
}

