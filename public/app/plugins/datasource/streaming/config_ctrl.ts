export class StreamingConfigCtrl {
  static templateUrl = 'partials/config.html';

  current: any; // the Current Configuration

  /** @ngInject */
  constructor($scope: any, $injector: any) {
    console.log('CONFIG Init', this);

    // Set the default value
    if (!this.current.jsonData.type) {
      this.current.jsonData.type = 'local';
    }
  }
}
