export class StreamingConfigCtrl {
  static templateUrl = 'partials/config.html';

  current: any; // the Current Configuration

  /** @ngInject */
  constructor($scope: any, $injector: any) {
    console.log('StreamingConfigCtrl Init', this);
  }
}
