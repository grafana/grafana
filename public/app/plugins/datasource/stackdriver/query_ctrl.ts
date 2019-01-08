import _ from 'lodash';

import { QueryCtrl } from 'app/plugins/sdk';
import { Target } from './types';

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    this.onQueryChange = this.onQueryChange.bind(this);
    this.onExecuteQuery = this.onExecuteQuery.bind(this);
  }

  onQueryChange(target: Target) {
    Object.assign(this.target, target);
  }

  onExecuteQuery() {
    this.$scope.ctrl.refresh();
  }
}
