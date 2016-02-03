///<reference path="../../../headers/common.d.ts" />

import './query_parameter_ctrl';
import _ from 'lodash';
import {QueryCtrl} from 'app/features/panel/panel';

export class CloudWatchQueryCtrl extends QueryCtrl {
  static templateUrl = 'public/app/plugins/datasource/cloudwatch/partials/query.editor.html';

  aliasSyntax: string;

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);
    this.aliasSyntax = '{{metric}} {{stat}} {{namespace}} {{region}} {{<dimension name>}}';
  }
}
