///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class CloudWatchConfigCtrl {
  static templateUrl = 'partials/config.html';
  current: any;

  accessKeyExist: boolean = false;
  secretKeyExist: boolean = false;

  /** @ngInject */
  constructor($scope) {
    this.current.jsonData.timeField = this.current.jsonData.timeField || '@timestamp';
    this.current.jsonData.authType = this.current.jsonData.authType || 'credentials';

    for (let key of this.current.encryptedFields) {
      if (key === "accessKey") {
        this.accessKeyExist = true;
      }
      if (key === "secretKey") {
        this.secretKeyExist = true;
      }
    }
  }

  resetAccessKey() {
    this.accessKeyExist = false;
  }

  resetSecretKey() {
    this.secretKeyExist = false;
  }

  authTypes = [
    {name: 'Access & secret key', value: 'keys'},
    {name: 'Credentials file', value: 'credentials'},
    {name: 'ARN', value: 'arn'},
  ];

  indexPatternTypes = [
    {name: 'No pattern',  value: undefined},
    {name: 'Hourly',      value: 'Hourly',  example: '[logstash-]YYYY.MM.DD.HH'},
    {name: 'Daily',       value: 'Daily',   example: '[logstash-]YYYY.MM.DD'},
    {name: 'Weekly',      value: 'Weekly',  example: '[logstash-]GGGG.WW'},
    {name: 'Monthly',     value: 'Monthly', example: '[logstash-]YYYY.MM'},
    {name: 'Yearly',      value: 'Yearly',  example: '[logstash-]YYYY'},
  ];
}

