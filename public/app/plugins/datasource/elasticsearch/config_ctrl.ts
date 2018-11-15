import _ from 'lodash';

export class ElasticConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/elasticsearch/partials/config.html';
  current: any;

  /** @ngInject */
  constructor($scope) {
    this.current.jsonData.timeField = this.current.jsonData.timeField || '@timestamp';
    this.current.jsonData.esVersion = this.current.jsonData.esVersion || 5;
    this.current.jsonData.maxConcurrentShardRequests = this.current.jsonData.maxConcurrentShardRequests || 256;
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
  ];

  indexPatternTypeChanged() {
    if (!this.current.database ||
        this.current.database.length === 0 ||
        this.current.database.startsWith('[logstash-]')) {
        const def = _.find(this.indexPatternTypes, {
          value: this.current.jsonData.interval,
        });
        this.current.database = def.example || 'es-index-name';
    }
  }
}
