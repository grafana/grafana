///<reference path="../../../headers/common.d.ts" />

import './query_parameter_ctrl';
import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';

export class CloudWatchQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  aliasSyntax: string;

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);
    this.aliasSyntax = '{{metric}} {{stat}} {{namespace}} {{region}} {{<dimension name>}}';
  }
}
