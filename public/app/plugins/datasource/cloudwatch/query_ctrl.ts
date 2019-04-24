import './query_parameter_ctrl';
import { QueryCtrl } from 'app/plugins/sdk';

export class CloudWatchQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  aliasSyntax: string;

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    this.aliasSyntax = '{{metric}} {{stat}} {{namespace}} {{region}} {{<dimension name>}}';
  }
}
