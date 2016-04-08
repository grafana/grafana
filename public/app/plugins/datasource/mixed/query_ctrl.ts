///<reference path="../../../headers/common.d.ts" />

import {QueryCtrl} from 'app/plugins/sdk';

export default class MixedQueryCtrl extends QueryCtrl {
  static template = "{{ctrl.queryCtrl}}";

  queryCtrl: any;

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);

    let id = this.target.datasourceMeta.id;
    this.queryCtrl = '<query-ctrl-' + id + '></query-ctrl-' + id + '>';
  }
}
