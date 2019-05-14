import moment from 'moment';
import _ from 'lodash';
var ResponseParser = /** @class */ (function () {
    function ResponseParser(results) {
        this.results = results;
    }
    ResponseParser.prototype.parseQueryResult = function () {
        var data = [];
        var columns = [];
        for (var i = 0; i < this.results.length; i++) {
            if (this.results[i].query.raw) {
                var xaxis = this.results[i].query.xaxis;
                var yaxises = this.results[i].query.yaxis;
                var spliton = this.results[i].query.spliton;
                columns = this.results[i].result.data.Tables[0].Columns;
                var rows = this.results[i].result.data.Tables[0].Rows;
                data = _.concat(data, this.parseRawQueryResultRow(this.results[i].query, columns, rows, xaxis, yaxises, spliton));
            }
            else {
                var value = this.results[i].result.data.value;
                var alias = this.results[i].query.alias;
                data = _.concat(data, this.parseQueryResultRow(this.results[i].query, value, alias));
            }
        }
        return data;
    };
    ResponseParser.prototype.parseRawQueryResultRow = function (query, columns, rows, xaxis, yaxises, spliton) {
        var data = [];
        var columnsForDropdown = _.map(columns, function (column) { return ({ text: column.ColumnName, value: column.ColumnName }); });
        var xaxisColumn = columns.findIndex(function (column) { return column.ColumnName === xaxis; });
        var yaxisesSplit = yaxises.split(',');
        var yaxisColumns = {};
        _.forEach(yaxisesSplit, function (yaxis) {
            yaxisColumns[yaxis] = columns.findIndex(function (column) { return column.ColumnName === yaxis; });
        });
        var splitonColumn = columns.findIndex(function (column) { return column.ColumnName === spliton; });
        var convertTimestamp = xaxis === 'timestamp';
        _.forEach(rows, function (row) {
            _.forEach(yaxisColumns, function (yaxisColumn, yaxisName) {
                var bucket = splitonColumn === -1
                    ? ResponseParser.findOrCreateBucket(data, yaxisName)
                    : ResponseParser.findOrCreateBucket(data, row[splitonColumn]);
                var epoch = convertTimestamp ? ResponseParser.dateTimeToEpoch(row[xaxisColumn]) : row[xaxisColumn];
                bucket.datapoints.push([row[yaxisColumn], epoch]);
                bucket.refId = query.refId;
                bucket.query = query.query;
                bucket.columnsForDropdown = columnsForDropdown;
            });
        });
        return data;
    };
    ResponseParser.prototype.parseQueryResultRow = function (query, value, alias) {
        var data = [];
        if (ResponseParser.isSingleValue(value)) {
            var metricName = ResponseParser.getMetricFieldKey(value);
            var aggField = ResponseParser.getKeyForAggregationField(value[metricName]);
            var epoch = ResponseParser.dateTimeToEpoch(value.end);
            data.push({
                target: metricName,
                datapoints: [[value[metricName][aggField], epoch]],
                refId: query.refId,
                query: query.query,
            });
            return data;
        }
        var groupedBy = ResponseParser.hasSegmentsField(value.segments[0]);
        if (!groupedBy) {
            var metricName = ResponseParser.getMetricFieldKey(value.segments[0]);
            var dataTarget = ResponseParser.findOrCreateBucket(data, metricName);
            for (var i = 0; i < value.segments.length; i++) {
                var epoch = ResponseParser.dateTimeToEpoch(value.segments[i].end);
                var aggField = ResponseParser.getKeyForAggregationField(value.segments[i][metricName]);
                dataTarget.datapoints.push([value.segments[i][metricName][aggField], epoch]);
            }
            dataTarget.refId = query.refId;
            dataTarget.query = query.query;
        }
        else {
            for (var i = 0; i < value.segments.length; i++) {
                var epoch = ResponseParser.dateTimeToEpoch(value.segments[i].end);
                for (var j = 0; j < value.segments[i].segments.length; j++) {
                    var metricName = ResponseParser.getMetricFieldKey(value.segments[i].segments[j]);
                    var aggField = ResponseParser.getKeyForAggregationField(value.segments[i].segments[j][metricName]);
                    var target = this.getTargetName(value.segments[i].segments[j], alias);
                    var bucket = ResponseParser.findOrCreateBucket(data, target);
                    bucket.datapoints.push([value.segments[i].segments[j][metricName][aggField], epoch]);
                    bucket.refId = query.refId;
                    bucket.query = query.query;
                }
            }
        }
        return data;
    };
    ResponseParser.prototype.getTargetName = function (segment, alias) {
        var metric = '';
        var segmentName = '';
        var segmentValue = '';
        for (var prop in segment) {
            if (_.isObject(segment[prop])) {
                metric = prop;
            }
            else {
                segmentName = prop;
                segmentValue = segment[prop];
            }
        }
        if (alias) {
            var regex = /\{\{([\s\S]+?)\}\}/g;
            return alias.replace(regex, function (match, g1, g2) {
                var group = g1 || g2;
                if (group === 'metric') {
                    return metric;
                }
                else if (group === 'groupbyname') {
                    return segmentName;
                }
                else if (group === 'groupbyvalue') {
                    return segmentValue;
                }
                return match;
            });
        }
        return metric + ("{" + segmentName + "=\"" + segmentValue + "\"}");
    };
    ResponseParser.isSingleValue = function (value) {
        return !ResponseParser.hasSegmentsField(value);
    };
    ResponseParser.findOrCreateBucket = function (data, target) {
        var dataTarget = _.find(data, ['target', target]);
        if (!dataTarget) {
            dataTarget = { target: target, datapoints: [] };
            data.push(dataTarget);
        }
        return dataTarget;
    };
    ResponseParser.hasSegmentsField = function (obj) {
        var keys = _.keys(obj);
        return _.indexOf(keys, 'segments') > -1;
    };
    ResponseParser.getMetricFieldKey = function (segment) {
        var keys = _.keys(segment);
        return _.filter(_.without(keys, 'start', 'end'), function (key) {
            return _.isObject(segment[key]);
        })[0];
    };
    ResponseParser.getKeyForAggregationField = function (dataObj) {
        var keys = _.keys(dataObj);
        return _.intersection(keys, ['sum', 'avg', 'min', 'max', 'count', 'unique'])[0];
    };
    ResponseParser.dateTimeToEpoch = function (dateTime) {
        return moment(dateTime).valueOf();
    };
    ResponseParser.parseMetricNames = function (result) {
        var keys = _.keys(result.data.metrics);
        return ResponseParser.toTextValueList(keys);
    };
    ResponseParser.prototype.parseMetadata = function (metricName) {
        var metric = this.results.data.metrics[metricName];
        if (!metric) {
            throw Error('No data found for metric: ' + metricName);
        }
        return {
            primaryAggType: metric.defaultAggregation,
            supportedAggTypes: metric.supportedAggregations,
            supportedGroupBy: metric.supportedGroupBy.all,
        };
    };
    ResponseParser.prototype.parseGroupBys = function () {
        return ResponseParser.toTextValueList(this.results.supportedGroupBy);
    };
    ResponseParser.prototype.parseQuerySchema = function () {
        var result = {
            Type: 'AppInsights',
            Tables: {},
        };
        if (this.results && this.results.data && this.results.data.Tables) {
            for (var i = 0; i < this.results.data.Tables[0].Rows.length; i++) {
                var column = this.results.data.Tables[0].Rows[i];
                var columnTable = column[0];
                var columnName = column[1];
                var columnType = column[2];
                if (result.Tables[columnTable]) {
                    result.Tables[columnTable].OrderedColumns.push({ Name: columnName, Type: columnType });
                }
                else {
                    result.Tables[columnTable] = {
                        Name: columnTable,
                        OrderedColumns: [{ Name: columnName, Type: columnType }],
                    };
                }
            }
        }
        return result;
    };
    ResponseParser.toTextValueList = function (values) {
        var list = [];
        for (var i = 0; i < values.length; i++) {
            list.push({
                text: values[i],
                value: values[i],
            });
        }
        return list;
    };
    return ResponseParser;
}());
export default ResponseParser;
//# sourceMappingURL=response_parser.js.map