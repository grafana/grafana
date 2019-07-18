export class OpenTsConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/opentsdb/partials/config.html';
  current: any;

  /** @ngInject */
  constructor($scope: any) {
    this.current.jsonData = this.current.jsonData || {};
    this.current.jsonData.tsdbVersion = this.current.jsonData.tsdbVersion || 1;
    this.current.jsonData.tsdbResolution = this.current.jsonData.tsdbResolution || 1;
  }

  tsdbVersions = [{ name: '<=2.1', value: 1 }, { name: '==2.2', value: 2 }, { name: '==2.3', value: 3 }];

  tsdbResolutions = [{ name: 'second', value: 1 }, { name: 'millisecond', value: 2 }];
}
