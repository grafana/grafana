import './query_parameter_ctrl';
import { QueryCtrl } from 'app/plugins/sdk';
import { auto } from 'angular';

export class CloudWatchQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  aliasSyntax: string;

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService) {
    super($scope, $injector);
    this.aliasSyntax = '{{metric}} {{stat}} {{namespace}} {{region}} {{<dimension name>}}';
  }
}
