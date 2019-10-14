import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';

export class AngularExamplePageCtrl {
  static templateUrl = 'legacy/angular_example_page.html';

  /** @ngInject */
  constructor($scope: any, $rootScope: GrafanaRootScope) {
    console.log('AngularExamplePageCtrl:', this);
  }
}
