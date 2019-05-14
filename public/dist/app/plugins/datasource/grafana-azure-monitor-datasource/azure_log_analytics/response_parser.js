import * as tslib_1 from "tslib";
import _ from 'lodash';
import moment from 'moment';
var ResponseParser = /** @class */ (function () {
    function ResponseParser(results) {
        this.results = results;
    }
    ResponseParser.prototype.parseQueryResult = function () {
        var data = [];
        var columns = [];
        for (var i = 0; i < this.results.length; i++) {
            if (this.results[i].result.data.tables.length === 0) {
                continue;
            }
            columns = this.results[i].result.data.tables[0].columns;
            var rows = this.results[i].result.data.tables[0].rows;
            if (this.results[i].query.resultFormat === 'time_series') {
                data = _.concat(data, this.parseTimeSeriesResult(this.results[i].query, columns, rows));
            }
            else {
                data = _.concat(data, this.parseTableResult(this.results[i].query, columns, rows));
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
        _.forEach(rows, function (row) {
            var epoch = ResponseParser.dateTimeToEpoch(row[timeIndex]);
            var metricName = metricIndex > -1 ? row[metricIndex] : columns[valueIndex].name;
            var bucket = ResponseParser.findOrCreateBucket(data, metricName);
            bucket.datapoints.push([row[valueIndex], epoch]);
            bucket.refId = query.refId;
            bucket.query = query.query;
        });
        return data;
    };
    ResponseParser.prototype.parseTableResult = function (query, columns, rows) {
        var tableResult = {
            type: 'table',
            columns: _.map(columns, function (col) {
                return { text: col.name, type: col.type };
            }),
            rows: rows,
            refId: query.refId,
            query: query.query,
        };
        return tableResult;
    };
    ResponseParser.prototype.parseToVariables = function () {
        var queryResult = this.parseQueryResult();
        var variables = [];
        _.forEach(queryResult, function (result) {
            _.forEach(_.flattenDeep(result.rows), function (row) {
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
        _.forEach(queryResult, function (result) {
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
            _.forEach(result.rows, function (row) {
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
    ResponseParser.prototype.parseSchemaResult = function () {
        return {
            Plugins: [
                {
                    Name: 'pivot',
                },
            ],
            Databases: this.createSchemaDatabaseWithTables(),
        };
    };
    ResponseParser.prototype.createSchemaDatabaseWithTables = function () {
        var databases = {
            Default: {
                Name: 'Default',
                Tables: this.createSchemaTables(),
                Functions: this.createSchemaFunctions(),
            },
        };
        return databases;
    };
    ResponseParser.prototype.createSchemaTables = function () {
        var e_1, _a, e_2, _b;
        var tables = {};
        try {
            for (var _c = tslib_1.__values(this.results.tables), _d = _c.next(); !_d.done; _d = _c.next()) {
                var table = _d.value;
                tables[table.name] = {
                    Name: table.name,
                    OrderedColumns: [],
                };
                try {
                    for (var _e = tslib_1.__values(table.columns), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var col = _f.value;
                        tables[table.name].OrderedColumns.push(this.convertToKustoColumn(col));
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return tables;
    };
    ResponseParser.prototype.convertToKustoColumn = function (col) {
        return {
            Name: col.name,
            Type: col.type,
        };
    };
    ResponseParser.prototype.createSchemaFunctions = function () {
        var e_3, _a;
        var functions = {};
        try {
            for (var _b = tslib_1.__values(this.results.functions), _c = _b.next(); !_c.done; _c = _b.next()) {
                var func = _c.value;
                functions[func.name] = {
                    Name: func.name,
                    Body: func.body,
                    DocString: func.displayName,
                    Folder: func.category,
                    FunctionKind: 'Unknown',
                    InputParameters: [],
                    OutputColumns: [],
                };
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return functions;
    };
    ResponseParser.findOrCreateBucket = function (data, target) {
        var dataTarget = _.find(data, ['target', target]);
        if (!dataTarget) {
            dataTarget = { target: target, datapoints: [], refId: '', query: '' };
            data.push(dataTarget);
        }
        return dataTarget;
    };
    ResponseParser.dateTimeToEpoch = function (dateTime) {
        return moment(dateTime).valueOf();
    };
    return ResponseParser;
}());
export default ResponseParser;
//# sourceMappingURL=response_parser.js.map