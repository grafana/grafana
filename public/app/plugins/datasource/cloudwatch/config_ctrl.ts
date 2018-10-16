import _ from 'lodash';
export class CloudWatchConfigCtrl {
  static templateUrl = 'partials/config.html';
  current: any;
  datasourceSrv: any;

  accessKeyExist = false;
  secretKeyExist = false;

  /** @ngInject */
  constructor($scope, datasourceSrv) {
    this.current.jsonData.timeField = this.current.jsonData.timeField || '@timestamp';
    this.current.jsonData.authType = this.current.jsonData.authType || 'credentials';

    this.accessKeyExist = this.current.secureJsonFields.accessKey;
    this.secretKeyExist = this.current.secureJsonFields.secretKey;
    this.datasourceSrv = datasourceSrv;
    this.getRegions();
  }

  resetAccessKey() {
    this.accessKeyExist = false;
  }

  resetSecretKey() {
    this.secretKeyExist = false;
  }

  authTypes = [
    { name: 'Access & secret key', value: 'keys' },
    { name: 'Credentials file', value: 'credentials' },
    { name: 'ARN', value: 'arn' },
  ];

  indexPatternTypes = [
    { name: 'No pattern', value: undefined },
    { name: 'Hourly', value: 'Hourly', example: '[logstash-]YYYY.MM.DD.HH' },
    { name: 'Daily', value: 'Daily', example: '[logstash-]YYYY.MM.DD' },
    { name: 'Weekly', value: 'Weekly', example: '[logstash-]GGGG.WW' },
    { name: 'Monthly', value: 'Monthly', example: '[logstash-]YYYY.MM' },
    { name: 'Yearly', value: 'Yearly', example: '[logstash-]YYYY' },
  ];

  regions = [];

  getRegions() {
    this.datasourceSrv
      .loadDatasource(this.current.name)
      .then(ds => {
        return ds.getRegions();
      })
      .then(
        regions => {
          this.regions = _.map(regions, 'value');
        },
        err => {
          console.error('failed to get latest regions');
        }
      );
  }
}
