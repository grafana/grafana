import * as tslib_1 from "tslib";
import './bucket_agg';
import './metric_agg';
import './pipeline_variables';
import angular from 'angular';
import _ from 'lodash';
import * as queryDef from './query_def';
import { QueryCtrl } from 'app/plugins/sdk';
var ElasticQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(ElasticQueryCtrl, _super);
    /** @ngInject */
    function ElasticQueryCtrl($scope, $injector, $rootScope, uiSegmentSrv) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.$rootScope = $rootScope;
        _this.uiSegmentSrv = uiSegmentSrv;
        _this.esVersion = _this.datasource.esVersion;
        _this.target = _this.target || {};
        _this.target.metrics = _this.target.metrics || [queryDef.defaultMetricAgg()];
        _this.target.bucketAggs = _this.target.bucketAggs || [queryDef.defaultBucketAgg()];
        if (_this.target.bucketAggs.length === 0) {
            var metric = _this.target.metrics[0];
            if (!metric || metric.type !== 'raw_document') {
                _this.target.bucketAggs = [queryDef.defaultBucketAgg()];
            }
            _this.refresh();
        }
        _this.queryUpdated();
        return _this;
    }
    ElasticQueryCtrl.prototype.getFields = function (type) {
        var jsonStr = angular.toJson({ find: 'fields', type: type });
        return this.datasource
            .metricFindQuery(jsonStr)
            .then(this.uiSegmentSrv.transformToSegments(false))
            .catch(this.handleQueryError.bind(this));
    };
    ElasticQueryCtrl.prototype.queryUpdated = function () {
        var newJson = angular.toJson(this.datasource.queryBuilder.build(this.target), true);
        if (this.rawQueryOld && newJson !== this.rawQueryOld) {
            this.refresh();
        }
        this.rawQueryOld = newJson;
        this.$rootScope.appEvent('elastic-query-updated');
    };
    ElasticQueryCtrl.prototype.getCollapsedText = function () {
        var metricAggs = this.target.metrics;
        var bucketAggs = this.target.bucketAggs;
        var metricAggTypes = queryDef.getMetricAggTypes(this.esVersion);
        var bucketAggTypes = queryDef.bucketAggTypes;
        var text = '';
        if (this.target.query) {
            text += 'Query: ' + this.target.query + ', ';
        }
        text += 'Metrics: ';
        _.each(metricAggs, function (metric, index) {
            var aggDef = _.find(metricAggTypes, { value: metric.type });
            text += aggDef.text + '(';
            if (aggDef.requiresField) {
                text += metric.field;
            }
            if (aggDef.supportsMultipleBucketPaths) {
                text += metric.settings.script.replace(new RegExp('params.', 'g'), '');
            }
            text += '), ';
        });
        _.each(bucketAggs, function (bucketAgg, index) {
            if (index === 0) {
                text += ' Group by: ';
            }
            var aggDef = _.find(bucketAggTypes, { value: bucketAgg.type });
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
    };
    ElasticQueryCtrl.prototype.handleQueryError = function (err) {
        this.error = err.message || 'Failed to issue metric query';
        return [];
    };
    ElasticQueryCtrl.templateUrl = 'partials/query.editor.html';
    return ElasticQueryCtrl;
}(QueryCtrl));
export { ElasticQueryCtrl };
//# sourceMappingURL=query_ctrl.js.map