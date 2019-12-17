export class AngularExamplePageCtrl {
  static templateUrl = 'legacy/angular_example_page.html';

  /** @ngInject */
  constructor($scope: any, $rootScope: any) {
    console.log('AngularExamplePageCtrl:', this);
  }
}
