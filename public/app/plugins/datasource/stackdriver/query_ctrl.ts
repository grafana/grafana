import _ from 'lodash';

import { QueryCtrl } from 'app/plugins/sdk';
import { react2AngularDirective } from 'app/core/utils/react2angular';

import { QueryEditor } from './components/QueryEditor';
import { Target } from './types';

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    this.handleQueryChange = this.handleQueryChange.bind(this);
    this.handleExecuteQuery = this.handleExecuteQuery.bind(this);
    react2AngularDirective('queryEditor', QueryEditor, [
      'target',
      'onQueryChange',
      'onExecuteQuery',
      ['events', { watchDepth: 'reference' }],
      ['datasource', { watchDepth: 'reference' }],
    ]);
  }

  handleQueryChange(target: Target) {
    Object.assign(this.target, target);
  }

  handleExecuteQuery() {
    this.$scope.ctrl.refresh();
  }
}
