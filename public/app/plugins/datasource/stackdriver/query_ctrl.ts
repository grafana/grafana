import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import './query_filter_ctrl';
import { registerAngularDirectives } from './angular_wrappers';
import { Target } from './types';

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    registerAngularDirectives();
    this.handleQueryChange = this.handleQueryChange.bind(this);
    this.handleExecuteQuery = this.handleExecuteQuery.bind(this);
  }

  handleQueryChange(target: Target) {
    Object.assign(this.target, target);
  }

  handleExecuteQuery() {
    this.$scope.ctrl.refresh();
  }
}
