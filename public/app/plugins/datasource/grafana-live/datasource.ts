///<reference path="../../../headers/common.d.ts" />

import {liveSrv} from 'app/core/core';

export class GrafanaStreamDS {

  /** @ngInject */
  constructor(private $q) {

  }

  query(options) {
    if (options.targets.length === 0) {
      return Promise.resolve({data: []});
    }

    var target = options.targets[0];
    liveSrv.subscribe(target.stream);

    return Promise.resolve({data: []});
  }
}

