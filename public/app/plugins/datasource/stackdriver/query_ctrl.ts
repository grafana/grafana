import './add_graphite_func';
import './func_editor';
import { QueryCtrl } from 'app/plugins/sdk';

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
  }
}
