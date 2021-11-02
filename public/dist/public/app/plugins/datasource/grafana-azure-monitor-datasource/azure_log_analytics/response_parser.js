import { __read } from "tslib";
import { concat, find, flattenDeep, forEach, get, map } from 'lodash';
import { dateTime } from '@grafana/data';
var ResponseParser = /** @class */ (function () {
    function ResponseParser(results) {
        this.results = results;
    }
    ResponseParser.prototype.parseQueryResult = function () {
        var data = [];
        var columns = [];
        for (var i = 0; i < this.results.length; i++) {
            if (this.results[i].result.tables.length === 0) {
                continue;
            }
            columns = this.results[i].result.tables[0].columns;
            var rows = this.results[i].result.tables[0].rows;
            if (this.results[i].query.resultFormat === 'time_series') {
                data = concat(data, this.parseTimeSeriesResult(this.results[i].query, columns, rows));
            }
            else {
                data = concat(data, this.parseTableResult(this.results[i].query, columns, rows));
            }
        }
        return data;
    };
    ResponseParser.prototype.parseTimeSeriesResult = function (query, columns, rows) {
        var data = [];
        var timeIndex = -1;
        var metricIndex = -1;
        var valueIndex = -1;
        for (var i = 0; i < columns.length; i++) {
            if (timeIndex === -1 && columns[i].type === 'datetime') {
                timeIndex = i;
            }
            if (metricIndex === -1 && columns[i].type === 'string') {
                metricIndex = i;
            }
            if (valueIndex === -1 && ['int', 'long', 'real', 'double'].indexOf(columns[i].type) > -1) {
                valueIndex = i;
            }
        }
        if (timeIndex === -1) {
            throw new Error('No datetime column found in the result. The Time Series format requires a time column.');
        }
        forEach(rows, function (row) {
            var epoch = ResponseParser.dateTimeToEpoch(row[timeIndex]);
            var metricName = metricIndex > -1 ? row[metricIndex] : columns[valueIndex].name;
            var bucket = ResponseParser.findOrCreateBucket(data, metricName);
            bucket.datapoints.push([row[valueIndex], epoch]);
            bucket.refId = query.refId;
            bucket.meta = {
                executedQueryString: query.query,
            };
        });
        return data;
    };
    ResponseParser.prototype.parseTableResult = function (query, columns, rows) {
        var tableResult = {
            type: 'table',
            columns: map(columns, function (col) {
                return { text: col.name, type: col.type };
            }),
            rows: rows,
            refId: query.refId,
            meta: {
                executedQueryString: query.query,
            },
        };
        return tableResult;
    };
    ResponseParser.prototype.parseToVariables = function () {
        var queryResult = this.parseQueryResult();
        var variables = [];
        forEach(queryResult, function (result) {
            forEach(flattenDeep(result.rows), function (row) {
                variables.push({
                    text: row,
                    value: row,
                });
            });
        });
        return variables;
    };
    ResponseParser.prototype.transformToAnnotations = function (options) {
        var queryResult = this.parseQueryResult();
        var list = [];
        forEach(queryResult, function (result) {
            var timeIndex = -1;
            var textIndex = -1;
            var tagsIndex = -1;
            for (var i = 0; i < result.columns.length; i++) {
                if (timeIndex === -1 && result.columns[i].type === 'datetime') {
                    timeIndex = i;
                }
                if (textIndex === -1 && result.columns[i].text.toLowerCase() === 'text') {
                    textIndex = i;
                }
                if (tagsIndex === -1 && result.columns[i].text.toLowerCase() === 'tags') {
                    tagsIndex = i;
                }
            }
            forEach(result.rows, function (row) {
                list.push({
                    annotation: options.annotation,
                    time: Math.floor(ResponseParser.dateTimeToEpoch(row[timeIndex])),
                    text: row[textIndex] ? row[textIndex].toString() : '',
                    tags: row[tagsIndex] ? row[tagsIndex].trim().split(/\s*,\s*/) : [],
                });
            });
        });
        return list;
    };
    ResponseParser.findOrCreateBucket = function (data, target) {
        var dataTarget = find(data, ['target', target]);
        if (!dataTarget) {
            dataTarget = { target: target, datapoints: [], refId: '', query: '' };
            data.push(dataTarget);
        }
        return dataTarget;
    };
    ResponseParser.dateTimeToEpoch = function (dateTimeValue) {
        return dateTime(dateTimeValue).valueOf();
    };
    ResponseParser.parseSubscriptions = function (result) {
        var list = [];
        if (!result) {
            return list;
        }
        var valueFieldName = 'subscriptionId';
        var textFieldName = 'displayName';
        for (var i = 0; i < result.value.length; i++) {
            if (!find(list, ['value', get(result.value[i], valueFieldName)])) {
                list.push({
                    text: "" + get(result.value[i], textFieldName),
                    value: get(result.value[i], valueFieldName),
                });
            }
        }
        return list;
    };
    return ResponseParser;
}());
export default ResponseParser;
// matches (name):(type) = (defaultValue)
// e.g. fromRangeStart:datetime = datetime(null)
//  - name: fromRangeStart
//  - type: datetime
//  - defaultValue: datetime(null)
var METADATA_FUNCTION_PARAMS = /([\w\W]+):([\w]+)(?:\s?=\s?([\w\W]+))?/;
function transformMetadataFunction(sourceSchema) {
    if (!sourceSchema.functions) {
        return [];
    }
    return sourceSchema.functions.map(function (fn) {
        var params = fn.parameters &&
            fn.parameters
                .split(', ')
                .map(function (arg) {
                var match = arg.match(METADATA_FUNCTION_PARAMS);
                if (!match) {
                    return;
                }
                var _a = __read(match, 4), name = _a[1], type = _a[2], defaultValue = _a[3];
                return {
                    name: name,
                    type: type,
                    defaultValue: defaultValue,
                    cslDefaultValue: defaultValue,
                };
            })
                .filter(function (v) { return !!v; });
        return {
            name: fn.name,
            body: fn.body,
            inputParameters: params || [],
        };
    });
}
export function transformMetadataToKustoSchema(sourceSchema, nameOrIdOrSomething) {
    var database = {
        name: nameOrIdOrSomething,
        tables: sourceSchema.tables,
        functions: transformMetadataFunction(sourceSchema),
        majorVersion: 0,
        minorVersion: 0,
    };
    return {
        clusterType: 'Engine',
        cluster: {
            connectionString: nameOrIdOrSomething,
            databases: [database],
        },
        database: database,
    };
}
//# sourceMappingURL=response_parser.js.map