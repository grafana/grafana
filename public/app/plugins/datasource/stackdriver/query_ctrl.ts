import _ from 'lodash';

import { QueryCtrl } from 'app/plugins/sdk';
import { StackdriverQuery } from './types';
import { TemplateSrv } from 'app/features/templating/template_srv';

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  templateSrv: TemplateSrv;

  /** @ngInject */
  constructor($scope, $injector, templateSrv) {
    super($scope, $injector);
    this.templateSrv = templateSrv;
    this.onQueryChange = this.onQueryChange.bind(this);
    this.onExecuteQuery = this.onExecuteQuery.bind(this);
  }

  onQueryChange(target: StackdriverQuery) {
    Object.assign(this.target, target);
  }

  onExecuteQuery() {
    this.$scope.ctrl.refresh();
  }
}
