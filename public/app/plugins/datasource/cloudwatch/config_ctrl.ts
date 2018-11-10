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

  regions = [
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-northeast-3',
    'ap-south-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ca-central-1',
    'cn-north-1',
    'cn-northwest-1',
    'eu-central-1',
    'eu-north-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'me-south-1',
    'sa-east-1',
    'us-east-1',
    'us-east-2',
    'us-gov-east-1',
    'us-gov-west-1',
    'us-iso-east-1',
    'us-isob-east-1',
    'us-west-1',
    'us-west-2',
  ];

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
