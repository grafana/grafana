import _ from 'lodash';
import { ElasticsearchOptions } from './types';
import { DataSourceInstanceSettings } from '@grafana/ui';
import { getMaxConcurrenShardRequestOrDefault } from './datasource';

export class ElasticConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/elasticsearch/partials/config.html';
  current: DataSourceInstanceSettings<ElasticsearchOptions>;

  /** @ngInject */
  constructor($scope) {
    this.current.jsonData.timeField = this.current.jsonData.timeField || '@timestamp';
    this.current.jsonData.esVersion = this.current.jsonData.esVersion || 5;
    const defaultMaxConcurrentShardRequests = this.current.jsonData.esVersion >= 70 ? 5 : 256;
    this.current.jsonData.maxConcurrentShardRequests =
      this.current.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests;
    this.current.jsonData.logMessageField = this.current.jsonData.logMessageField || '';
    this.current.jsonData.logLevelField = this.current.jsonData.logLevelField || '';
  }

  indexPatternTypes = [
    { name: 'No pattern', value: undefined },
    { name: 'Hourly', value: 'Hourly', example: '[logstash-]YYYY.MM.DD.HH' },
    { name: 'Daily', value: 'Daily', example: '[logstash-]YYYY.MM.DD' },
    { name: 'Weekly', value: 'Weekly', example: '[logstash-]GGGG.WW' },
    { name: 'Monthly', value: 'Monthly', example: '[logstash-]YYYY.MM' },
    { name: 'Yearly', value: 'Yearly', example: '[logstash-]YYYY' },
  ];

  esVersions = [
    { name: '2.x', value: 2 },
    { name: '5.x', value: 5 },
    { name: '5.6+', value: 56 },
    { name: '6.0+', value: 60 },
    { name: '7.0+', value: 70 },
  ];

  indexPatternTypeChanged() {
    if (
      !this.current.database ||
      this.current.database.length === 0 ||
      this.current.database.startsWith('[logstash-]')
    ) {
      const def: any = _.find(this.indexPatternTypes, {
        value: this.current.jsonData.interval,
      });
      this.current.database = def.example || 'es-index-name';
    }
  }

  versionChanged() {
    this.current.jsonData.maxConcurrentShardRequests = getMaxConcurrenShardRequestOrDefault(this.current.jsonData);
  }
}
