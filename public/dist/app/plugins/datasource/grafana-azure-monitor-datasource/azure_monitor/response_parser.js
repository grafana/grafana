import moment from 'moment';
import _ from 'lodash';
import TimeGrainConverter from '../time_grain_converter';
var ResponseParser = /** @class */ (function () {
    function ResponseParser(results) {
        this.results = results;
    }
    ResponseParser.prototype.parseQueryResult = function () {
        var data = [];
        for (var i = 0; i < this.results.length; i++) {
            for (var j = 0; j < this.results[i].result.data.value.length; j++) {
                for (var k = 0; k < this.results[i].result.data.value[j].timeseries.length; k++) {
                    var alias = this.results[i].query.alias;
                    data.push({
                        target: ResponseParser.createTarget(this.results[i].result.data.value[j], this.results[i].result.data.value[j].timeseries[k].metadatavalues, alias),
                        datapoints: ResponseParser.convertDataToPoints(this.results[i].result.data.value[j].timeseries[k].data),
                    });
                }
            }
        }
        return data;
    };
    ResponseParser.createTarget = function (data, metadatavalues, alias) {
        var resourceGroup = ResponseParser.parseResourceGroupFromId(data.id);
        var resourceName = ResponseParser.parseResourceNameFromId(data.id);
        var namespace = ResponseParser.parseNamespaceFromId(data.id, resourceName);
        if (alias) {
            var regex = /\{\{([\s\S]+?)\}\}/g;
            return alias.replace(regex, function (match, g1, g2) {
                var group = g1 || g2;
                if (group === 'resourcegroup') {
                    return resourceGroup;
                }
                else if (group === 'namespace') {
                    return namespace;
                }
                else if (group === 'resourcename') {
                    return resourceName;
                }
                else if (group === 'metric') {
                    return data.name.value;
                }
                else if (group === 'dimensionname') {
                    return metadatavalues && metadatavalues.length > 0 ? metadatavalues[0].name.value : '';
                }
                else if (group === 'dimensionvalue') {
                    return metadatavalues && metadatavalues.length > 0 ? metadatavalues[0].value : '';
                }
                return match;
            });
        }
        if (metadatavalues && metadatavalues.length > 0) {
            return resourceName + "{" + metadatavalues[0].name.value + "=" + metadatavalues[0].value + "}." + data.name.value;
        }
        return resourceName + "." + data.name.value;
    };
    ResponseParser.parseResourceGroupFromId = function (id) {
        var startIndex = id.indexOf('/resourceGroups/') + 16;
        var endIndex = id.indexOf('/providers');
        return id.substring(startIndex, endIndex);
    };
    ResponseParser.parseNamespaceFromId = function (id, resourceName) {
        var startIndex = id.indexOf('/providers/') + 11;
        var endIndex = id.indexOf('/' + resourceName);
        return id.substring(startIndex, endIndex);
    };
    ResponseParser.parseResourceNameFromId = function (id) {
        var endIndex = id.lastIndexOf('/providers');
        var startIndex = id.slice(0, endIndex).lastIndexOf('/') + 1;
        return id.substring(startIndex, endIndex);
    };
    ResponseParser.convertDataToPoints = function (timeSeriesData) {
        var dataPoints = [];
        for (var k = 0; k < timeSeriesData.length; k++) {
            var epoch = ResponseParser.dateTimeToEpoch(timeSeriesData[k].timeStamp);
            var aggKey = ResponseParser.getKeyForAggregationField(timeSeriesData[k]);
            if (aggKey) {
                dataPoints.push([timeSeriesData[k][aggKey], epoch]);
            }
        }
        return dataPoints;
    };
    ResponseParser.dateTimeToEpoch = function (dateTime) {
        return moment(dateTime).valueOf();
    };
    ResponseParser.getKeyForAggregationField = function (dataObj) {
        var keys = _.keys(dataObj);
        if (keys.length < 2) {
            return '';
        }
        return _.intersection(keys, ['total', 'average', 'maximum', 'minimum', 'count'])[0];
    };
    ResponseParser.parseResponseValues = function (result, textFieldName, valueFieldName) {
        var list = [];
        for (var i = 0; i < result.data.value.length; i++) {
            if (!_.find(list, ['value', _.get(result.data.value[i], valueFieldName)])) {
                list.push({
                    text: _.get(result.data.value[i], textFieldName),
                    value: _.get(result.data.value[i], valueFieldName),
                });
            }
        }
        return list;
    };
    ResponseParser.parseResourceNames = function (result, metricDefinition) {
        var list = [];
        for (var i = 0; i < result.data.value.length; i++) {
            if (result.data.value[i].type === metricDefinition) {
                list.push({
                    text: result.data.value[i].name,
                    value: result.data.value[i].name,
                });
            }
        }
        return list;
    };
    ResponseParser.parseMetadata = function (result, metricName) {
        var metricData = _.find(result.data.value, function (o) {
            return _.get(o, 'name.value') === metricName;
        });
        var defaultAggTypes = ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'];
        return {
            primaryAggType: metricData.primaryAggregationType,
            supportedAggTypes: metricData.supportedAggregationTypes || defaultAggTypes,
            supportedTimeGrains: ResponseParser.parseTimeGrains(metricData.metricAvailabilities || []),
            dimensions: ResponseParser.parseDimensions(metricData),
        };
    };
    ResponseParser.parseTimeGrains = function (metricAvailabilities) {
        var timeGrains = [];
        metricAvailabilities.forEach(function (avail) {
            if (avail.timeGrain) {
                timeGrains.push({
                    text: TimeGrainConverter.createTimeGrainFromISO8601Duration(avail.timeGrain),
                    value: avail.timeGrain,
                });
            }
        });
        return timeGrains;
    };
    ResponseParser.parseDimensions = function (metricData) {
        var dimensions = [];
        if (!metricData.dimensions || metricData.dimensions.length === 0) {
            return dimensions;
        }
        if (!metricData.isDimensionRequired) {
            dimensions.push({ text: 'None', value: 'None' });
        }
        for (var i = 0; i < metricData.dimensions.length; i++) {
            dimensions.push({
                text: metricData.dimensions[i].localizedValue,
                value: metricData.dimensions[i].value,
            });
        }
        return dimensions;
    };
    return ResponseParser;
}());
export default ResponseParser;
//# sourceMappingURL=response_parser.js.map