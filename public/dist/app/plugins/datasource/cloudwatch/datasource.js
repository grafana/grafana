import angular from 'angular';
import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';
import kbn from 'app/core/utils/kbn';
import * as templatingVariable from 'app/features/templating/variable';
// import * as moment from 'moment';
var CloudWatchDatasource = /** @class */ (function () {
    /** @ngInject */
    function CloudWatchDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv) {
        this.$q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.type = 'cloudwatch';
        this.name = instanceSettings.name;
        this.proxyUrl = instanceSettings.url;
        this.defaultRegion = instanceSettings.jsonData.defaultRegion;
        this.instanceSettings = instanceSettings;
        this.standardStatistics = ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'];
    }
    CloudWatchDatasource.prototype.query = function (options) {
        var _this = this;
        options = angular.copy(options);
        options.targets = this.expandTemplateVariable(options.targets, options.scopedVars, this.templateSrv);
        var queries = _.filter(options.targets, function (item) {
            return ((item.id !== '' || item.hide !== true) &&
                ((!!item.region && !!item.namespace && !!item.metricName && !_.isEmpty(item.statistics)) ||
                    item.expression.length > 0));
        }).map(function (item) {
            item.region = _this.templateSrv.replace(_this.getActualRegion(item.region), options.scopedVars);
            item.namespace = _this.templateSrv.replace(item.namespace, options.scopedVars);
            item.metricName = _this.templateSrv.replace(item.metricName, options.scopedVars);
            item.dimensions = _this.convertDimensionFormat(item.dimensions, options.scopedVars);
            item.statistics = item.statistics.map(function (s) {
                return _this.templateSrv.replace(s, options.scopedVars);
            });
            item.period = String(_this.getPeriod(item, options)); // use string format for period in graph query, and alerting
            item.id = _this.templateSrv.replace(item.id, options.scopedVars);
            item.expression = _this.templateSrv.replace(item.expression, options.scopedVars);
            item.returnData = typeof item.hide === 'undefined' ? true : !item.hide;
            // valid ExtendedStatistics is like p90.00, check the pattern
            var hasInvalidStatistics = item.statistics.some(function (s) {
                if (s.indexOf('p') === 0) {
                    var matches = /^p\d{2}(?:\.\d{1,2})?$/.exec(s);
                    return !matches || matches[0] !== s;
                }
                return false;
            });
            if (hasInvalidStatistics) {
                throw { message: 'Invalid extended statistics' };
            }
            return _.extend({
                refId: item.refId,
                intervalMs: options.intervalMs,
                maxDataPoints: options.maxDataPoints,
                datasourceId: _this.instanceSettings.id,
                type: 'timeSeriesQuery',
            }, item);
        });
        // No valid targets, return the empty result to save a round trip.
        if (_.isEmpty(queries)) {
            var d = this.$q.defer();
            d.resolve({ data: [] });
            return d.promise;
        }
        var request = {
            from: options.range.from.valueOf().toString(),
            to: options.range.to.valueOf().toString(),
            queries: queries,
        };
        return this.performTimeSeriesQuery(request);
    };
    CloudWatchDatasource.prototype.getPeriod = function (target, options, now) {
        var start = this.convertToCloudWatchTime(options.range.from, false);
        var end = this.convertToCloudWatchTime(options.range.to, true);
        now = Math.round((now || Date.now()) / 1000);
        var period;
        var range = end - start;
        var hourSec = 60 * 60;
        var daySec = hourSec * 24;
        var periodUnit = 60;
        if (!target.period) {
            if (now - start <= daySec * 15) {
                // until 15 days ago
                if (target.namespace === 'AWS/EC2') {
                    periodUnit = period = 300;
                }
                else {
                    periodUnit = period = 60;
                }
            }
            else if (now - start <= daySec * 63) {
                // until 63 days ago
                periodUnit = period = 60 * 5;
            }
            else if (now - start <= daySec * 455) {
                // until 455 days ago
                periodUnit = period = 60 * 60;
            }
            else {
                // over 455 days, should return error, but try to long period
                periodUnit = period = 60 * 60;
            }
        }
        else {
            if (/^\d+$/.test(target.period)) {
                period = parseInt(target.period, 10);
            }
            else {
                period = kbn.interval_to_seconds(this.templateSrv.replace(target.period, options.scopedVars));
            }
        }
        if (period < 1) {
            period = 1;
        }
        if (!target.highResolution && range / period >= 1440) {
            period = Math.ceil(range / 1440 / periodUnit) * periodUnit;
        }
        return period;
    };
    CloudWatchDatasource.prototype.performTimeSeriesQuery = function (request) {
        return this.awsRequest('/api/tsdb/query', request).then(function (res) {
            var data = [];
            if (res.results) {
                _.forEach(res.results, function (queryRes) {
                    _.forEach(queryRes.series, function (series) {
                        var s = { target: series.name, datapoints: series.points };
                        if (queryRes.meta.unit) {
                            s.unit = queryRes.meta.unit;
                        }
                        data.push(s);
                    });
                });
            }
            return { data: data };
        });
    };
    CloudWatchDatasource.prototype.transformSuggestDataFromTable = function (suggestData) {
        return _.map(suggestData.results['metricFindQuery'].tables[0].rows, function (v) {
            return {
                text: v[0],
                value: v[1],
            };
        });
    };
    CloudWatchDatasource.prototype.doMetricQueryRequest = function (subtype, parameters) {
        var _this = this;
        var range = this.timeSrv.timeRange();
        return this.awsRequest('/api/tsdb/query', {
            from: range.from.valueOf().toString(),
            to: range.to.valueOf().toString(),
            queries: [
                _.extend({
                    refId: 'metricFindQuery',
                    intervalMs: 1,
                    maxDataPoints: 1,
                    datasourceId: this.instanceSettings.id,
                    type: 'metricFindQuery',
                    subtype: subtype,
                }, parameters),
            ],
        }).then(function (r) {
            return _this.transformSuggestDataFromTable(r);
        });
    };
    CloudWatchDatasource.prototype.getRegions = function () {
        return this.doMetricQueryRequest('regions', null);
    };
    CloudWatchDatasource.prototype.getNamespaces = function () {
        return this.doMetricQueryRequest('namespaces', null);
    };
    CloudWatchDatasource.prototype.getMetrics = function (namespace, region) {
        return this.doMetricQueryRequest('metrics', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            namespace: this.templateSrv.replace(namespace),
        });
    };
    CloudWatchDatasource.prototype.getDimensionKeys = function (namespace, region) {
        return this.doMetricQueryRequest('dimension_keys', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            namespace: this.templateSrv.replace(namespace),
        });
    };
    CloudWatchDatasource.prototype.getDimensionValues = function (region, namespace, metricName, dimensionKey, filterDimensions) {
        return this.doMetricQueryRequest('dimension_values', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            namespace: this.templateSrv.replace(namespace),
            metricName: this.templateSrv.replace(metricName),
            dimensionKey: this.templateSrv.replace(dimensionKey),
            dimensions: this.convertDimensionFormat(filterDimensions, {}),
        });
    };
    CloudWatchDatasource.prototype.getEbsVolumeIds = function (region, instanceId) {
        return this.doMetricQueryRequest('ebs_volume_ids', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            instanceId: this.templateSrv.replace(instanceId),
        });
    };
    CloudWatchDatasource.prototype.getEc2InstanceAttribute = function (region, attributeName, filters) {
        return this.doMetricQueryRequest('ec2_instance_attribute', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            attributeName: this.templateSrv.replace(attributeName),
            filters: filters,
        });
    };
    CloudWatchDatasource.prototype.getResourceARNs = function (region, resourceType, tags) {
        return this.doMetricQueryRequest('resource_arns', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            resourceType: this.templateSrv.replace(resourceType),
            tags: tags,
        });
    };
    CloudWatchDatasource.prototype.metricFindQuery = function (query) {
        var region;
        var namespace;
        var metricName;
        var filterJson;
        var regionQuery = query.match(/^regions\(\)/);
        if (regionQuery) {
            return this.getRegions();
        }
        var namespaceQuery = query.match(/^namespaces\(\)/);
        if (namespaceQuery) {
            return this.getNamespaces();
        }
        var metricNameQuery = query.match(/^metrics\(([^\)]+?)(,\s?([^,]+?))?\)/);
        if (metricNameQuery) {
            namespace = metricNameQuery[1];
            region = metricNameQuery[3];
            return this.getMetrics(namespace, region);
        }
        var dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
        if (dimensionKeysQuery) {
            namespace = dimensionKeysQuery[1];
            region = dimensionKeysQuery[3];
            return this.getDimensionKeys(namespace, region);
        }
        var dimensionValuesQuery = query.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/);
        if (dimensionValuesQuery) {
            region = dimensionValuesQuery[1];
            namespace = dimensionValuesQuery[2];
            metricName = dimensionValuesQuery[3];
            var dimensionKey = dimensionValuesQuery[4];
            filterJson = {};
            if (dimensionValuesQuery[6]) {
                filterJson = JSON.parse(this.templateSrv.replace(dimensionValuesQuery[6]));
            }
            return this.getDimensionValues(region, namespace, metricName, dimensionKey, filterJson);
        }
        var ebsVolumeIdsQuery = query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
        if (ebsVolumeIdsQuery) {
            region = ebsVolumeIdsQuery[1];
            var instanceId = ebsVolumeIdsQuery[2];
            return this.getEbsVolumeIds(region, instanceId);
        }
        var ec2InstanceAttributeQuery = query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
        if (ec2InstanceAttributeQuery) {
            region = ec2InstanceAttributeQuery[1];
            var targetAttributeName = ec2InstanceAttributeQuery[2];
            filterJson = JSON.parse(this.templateSrv.replace(ec2InstanceAttributeQuery[3]));
            return this.getEc2InstanceAttribute(region, targetAttributeName, filterJson);
        }
        var resourceARNsQuery = query.match(/^resource_arns\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
        if (resourceARNsQuery) {
            region = resourceARNsQuery[1];
            var resourceType = resourceARNsQuery[2];
            var tagsJSON = JSON.parse(this.templateSrv.replace(resourceARNsQuery[3]));
            return this.getResourceARNs(region, resourceType, tagsJSON);
        }
        return this.$q.when([]);
    };
    CloudWatchDatasource.prototype.annotationQuery = function (options) {
        var _this = this;
        var annotation = options.annotation;
        var statistics = _.map(annotation.statistics, function (s) {
            return _this.templateSrv.replace(s);
        });
        var defaultPeriod = annotation.prefixMatching ? '' : '300';
        var period = annotation.period || defaultPeriod;
        period = parseInt(period, 10);
        var parameters = {
            prefixMatching: annotation.prefixMatching,
            region: this.templateSrv.replace(this.getActualRegion(annotation.region)),
            namespace: this.templateSrv.replace(annotation.namespace),
            metricName: this.templateSrv.replace(annotation.metricName),
            dimensions: this.convertDimensionFormat(annotation.dimensions, {}),
            statistics: statistics,
            period: period,
            actionPrefix: annotation.actionPrefix || '',
            alarmNamePrefix: annotation.alarmNamePrefix || '',
        };
        return this.awsRequest('/api/tsdb/query', {
            from: options.range.from.valueOf().toString(),
            to: options.range.to.valueOf().toString(),
            queries: [
                _.extend({
                    refId: 'annotationQuery',
                    intervalMs: 1,
                    maxDataPoints: 1,
                    datasourceId: this.instanceSettings.id,
                    type: 'annotationQuery',
                }, parameters),
            ],
        }).then(function (r) {
            return _.map(r.results['annotationQuery'].tables[0].rows, function (v) {
                return {
                    annotation: annotation,
                    time: Date.parse(v[0]),
                    title: v[1],
                    tags: [v[2]],
                    text: v[3],
                };
            });
        });
    };
    CloudWatchDatasource.prototype.targetContainsTemplate = function (target) {
        var _this = this;
        return (this.templateSrv.variableExists(target.region) ||
            this.templateSrv.variableExists(target.namespace) ||
            this.templateSrv.variableExists(target.metricName) ||
            _.find(target.dimensions, function (v, k) {
                return _this.templateSrv.variableExists(k) || _this.templateSrv.variableExists(v);
            }));
    };
    CloudWatchDatasource.prototype.testDatasource = function () {
        /* use billing metrics for test */
        var region = this.defaultRegion;
        var namespace = 'AWS/Billing';
        var metricName = 'EstimatedCharges';
        var dimensions = {};
        return this.getDimensionValues(region, namespace, metricName, 'ServiceName', dimensions).then(function () {
            return { status: 'success', message: 'Data source is working' };
        });
    };
    CloudWatchDatasource.prototype.awsRequest = function (url, data) {
        var options = {
            method: 'POST',
            url: url,
            data: data,
        };
        return this.backendSrv.datasourceRequest(options).then(function (result) {
            return result.data;
        });
    };
    CloudWatchDatasource.prototype.getDefaultRegion = function () {
        return this.defaultRegion;
    };
    CloudWatchDatasource.prototype.getActualRegion = function (region) {
        if (region === 'default' || _.isEmpty(region)) {
            return this.getDefaultRegion();
        }
        return region;
    };
    CloudWatchDatasource.prototype.getExpandedVariables = function (target, dimensionKey, variable, templateSrv) {
        /* if the all checkbox is marked we should add all values to the targets */
        var allSelected = _.find(variable.options, { selected: true, text: 'All' });
        var selectedVariables = _.filter(variable.options, function (v) {
            if (allSelected) {
                return v.text !== 'All';
            }
            else {
                return v.selected;
            }
        });
        var currentVariables = !_.isArray(variable.current.value)
            ? [variable.current]
            : variable.current.value.map(function (v) {
                return {
                    text: v,
                    value: v,
                };
            });
        var useSelectedVariables = selectedVariables.some(function (s) {
            return s.value === currentVariables[0].value;
        }) || currentVariables[0].value === '$__all';
        return (useSelectedVariables ? selectedVariables : currentVariables).map(function (v) {
            var t = angular.copy(target);
            var scopedVar = {};
            scopedVar[variable.name] = v;
            t.refId = target.refId + '_' + v.value;
            t.dimensions[dimensionKey] = templateSrv.replace(t.dimensions[dimensionKey], scopedVar);
            if (variable.multi && target.id) {
                t.id = target.id + window.btoa(v.value).replace(/=/g, '0'); // generate unique id
            }
            else {
                t.id = target.id;
            }
            return t;
        });
    };
    CloudWatchDatasource.prototype.expandTemplateVariable = function (targets, scopedVars, templateSrv) {
        var _this = this;
        // Datasource and template srv logic uber-complected. This should be cleaned up.
        return _.chain(targets)
            .map(function (target) {
            var dimensionKey = _.findKey(target.dimensions, function (v) {
                return templateSrv.variableExists(v) && !_.has(scopedVars, templateSrv.getVariableName(v));
            });
            if (dimensionKey) {
                var multiVariable = _.find(templateSrv.variables, function (variable) {
                    return (templatingVariable.containsVariable(target.dimensions[dimensionKey], variable.name) && variable.multi);
                });
                var variable = _.find(templateSrv.variables, function (variable) {
                    return templatingVariable.containsVariable(target.dimensions[dimensionKey], variable.name);
                });
                return _this.getExpandedVariables(target, dimensionKey, multiVariable || variable, templateSrv);
            }
            else {
                return [target];
            }
        })
            .flatten()
            .value();
    };
    CloudWatchDatasource.prototype.convertToCloudWatchTime = function (date, roundUp) {
        if (_.isString(date)) {
            date = dateMath.parse(date, roundUp);
        }
        return Math.round(date.valueOf() / 1000);
    };
    CloudWatchDatasource.prototype.convertDimensionFormat = function (dimensions, scopedVars) {
        var _this = this;
        var convertedDimensions = {};
        _.each(dimensions, function (value, key) {
            convertedDimensions[_this.templateSrv.replace(key, scopedVars)] = _this.templateSrv.replace(value, scopedVars);
        });
        return convertedDimensions;
    };
    return CloudWatchDatasource;
}());
export default CloudWatchDatasource;
//# sourceMappingURL=datasource.js.map