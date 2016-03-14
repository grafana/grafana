///<reference path="../../../headers/common.d.ts" />

import {liveSrv} from 'app/core/core';

export class GrafanaStreamDS {
  subscription: any;

  /** @ngInject */
  constructor(private $q) {

  }

  query(options) {
    if (options.targets.length === 0) {
      return Promise.resolve({data: []});
    }

    var target = options.targets[0];
    var observable = liveSrv.subscribe(target.stream);
    this.subscription = observable.subscribe(data => {
      console.log("grafana stream ds data!", data);
    });

    return Promise.resolve({data: []});
  }
}

