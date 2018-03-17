import { liveSrv } from 'app/core/core';

class DataObservable {
  target: any;

  constructor(target) {
    this.target = target;
  }

  subscribe(options) {
    var observable = liveSrv.subscribe(this.target.stream);
    return observable.subscribe(data => {
      console.log('grafana stream ds data!', data);
    });
  }
}

export class GrafanaStreamDS {
  subscription: any;

  /** @ngInject */
  constructor() {}

  query(options): any {
    if (options.targets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    var target = options.targets[0];
    var observable = new DataObservable(target);

    return Promise.resolve(observable);
  }
}
