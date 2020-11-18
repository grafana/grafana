import './bucket_agg';
import './metric_agg';
import './pipeline_variables';

import angular, { auto } from 'angular';
import _ from 'lodash';
import * as queryDef from './query_def';
import { QueryCtrl } from 'app/plugins/sdk';
import { ElasticsearchAggregation, ElasticsearchQueryType } from './types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { CoreEvents } from 'app/types';

export class ElasticQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  esVersion: any;
  rawQueryOld: string;
  targetMetricsOld: string;
  pplSupportEnabled?: boolean;
  showHelp: boolean;

  esQueryType = ElasticsearchQueryType;

  /** @ngInject */
  constructor(
    $scope: any,
    $injector: auto.IInjectorService,
    private $rootScope: GrafanaRootScope,
    private uiSegmentSrv: any
  ) {
    super($scope, $injector);

    this.esVersion = this.datasource.esVersion;
    this.pplSupportEnabled = this.datasource.pplSupportEnabled;

    this.target = this.target || {};
    this.target.queryType = this.target.queryType || ElasticsearchQueryType.Lucene;
    this.target.format = this.target.format || queryDef.defaultPPLFormat();
    this.target.metrics = this.target.metrics || [queryDef.defaultMetricAgg()];
    this.target.bucketAggs = this.target.bucketAggs || [queryDef.defaultBucketAgg()];

    if (this.target.bucketAggs.length === 0) {
      const metric = this.target.metrics[0];
      if (!metric || metric.type !== 'raw_document') {
        this.target.bucketAggs = [queryDef.defaultBucketAgg()];
      }
      this.refresh();
    }

    this.queryUpdated();
  }

  getQueryInputPlaceholder(): string {
    switch (this.target.queryType) {
      case ElasticsearchQueryType.PPL:
        return 'PPL query';
      case ElasticsearchQueryType.Lucene:
        return 'Lucene query';
      default:
        return '';
    }
  }

  getQueryTypes() {
    const supportedTypes: ElasticsearchQueryType[] = [
      ElasticsearchQueryType.Lucene,
      ...(this.pplSupportEnabled ? [ElasticsearchQueryType.PPL] : []),
    ];
    return queryDef.getQueryTypes(supportedTypes);
  }

  getPPLFormatTypes() {
    return queryDef.pplFormatTypes;
  }

  getFields(type: any) {
    const jsonStr = angular.toJson({ find: 'fields', type: type });
    return this.datasource
      .metricFindQuery(jsonStr)
      .then(this.uiSegmentSrv.transformToSegments(false))
      .catch(this.handleQueryError.bind(this));
  }

  queryUpdated() {
    const newJsonTargetMetrics = angular.toJson(this.target.metrics);
    let newJsonRawQuery = '';
    if (this.target.queryType === ElasticsearchQueryType.PPL) {
      // TODO: Implement query builder method for PPL queries
    } else {
      newJsonRawQuery = angular.toJson(this.datasource.queryBuilder.build(this.target), true);
    }
    if (
      (this.rawQueryOld && newJsonRawQuery !== this.rawQueryOld) ||
      (this.targetMetricsOld && newJsonTargetMetrics !== this.targetMetricsOld)
    ) {
      this.refresh();
    }

    this.rawQueryOld = newJsonRawQuery;
    this.targetMetricsOld = newJsonTargetMetrics;
    this.$rootScope.appEvent(CoreEvents.elasticQueryUpdated);
  }

  getCollapsedText() {
    const metricAggs: ElasticsearchAggregation[] = this.target.metrics;
    const bucketAggs = this.target.bucketAggs;
    const metricAggTypes = queryDef.getMetricAggTypes(this.esVersion);
    const bucketAggTypes = queryDef.bucketAggTypes;
    let text = '';

    if (this.target.query) {
      text += 'Query: ' + this.target.query + ', ';
    }

    text += 'Metrics: ';

    _.each(metricAggs, (metric, index) => {
      const aggDef: any = _.find(metricAggTypes, { value: metric.type });
      text += aggDef.text + '(';
      if (aggDef.requiresField) {
        text += metric.field;
      }
      if (aggDef.supportsMultipleBucketPaths) {
        text += metric.settings.script.replace(new RegExp('params.', 'g'), '');
      }
      text += '), ';
    });

    _.each(bucketAggs, (bucketAgg: any, index: number) => {
      if (index === 0) {
        text += ' Group by: ';
      }

      const aggDef: any = _.find(bucketAggTypes, { value: bucketAgg.type });
      text += aggDef.text + '(';
      if (aggDef.requiresField) {
        text += bucketAgg.field;
      }
      text += '), ';
    });

    if (this.target.alias) {
      text += 'Alias: ' + this.target.alias;
    }

    return text;
  }

  handleQueryError(err: any): any[] {
    this.error = err.message || 'Failed to issue metric query';
    return [];
  }
}
