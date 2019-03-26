import { QueryCtrl } from 'app/plugins/sdk';

export class StreamingQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  /** @ngInject */
  constructor($scope: any, $injector: any) {
    super($scope, $injector);

    if (!this.target.speed) {
      this.target.speed = 250;
    }
    if (!this.target.spread) {
      this.target.spread = 2;
    }
  }

  // Called from the search window
  onKeyPress(event: any) {
    if (event.which === 13) {
      this.panelCtrl.refresh();
    }
  }

  getCollapsedText() {
    return this.target.url;
  }
}
