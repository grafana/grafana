import * as tslib_1 from "tslib";
import _ from 'lodash';
var ResponseParser = /** @class */ (function () {
    function ResponseParser($q) {
        this.$q = $q;
    }
    ResponseParser.prototype.processQueryResult = function (res) {
        var e_1, _a, e_2, _b;
        var data = [];
        if (!res.data.results) {
            return { data: data };
        }
        for (var key in res.data.results) {
            var queryRes = res.data.results[key];
            if (queryRes.series) {
                try {
                    for (var _c = tslib_1.__values(queryRes.series), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var series = _d.value;
                        data.push({
                            target: series.name,
                            datapoints: series.points,
                            refId: queryRes.refId,
                            meta: queryRes.meta,
                        });
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            if (queryRes.tables) {
                try {
                    for (var _e = tslib_1.__values(queryRes.tables), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var table = _f.value;
                        table.type = 'table';
                        table.refId = queryRes.refId;
                        table.meta = queryRes.meta;
                        data.push(table);
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
        return { data: data };
    };
    ResponseParser.prototype.parseMetricFindQueryResult = function (refId, results) {
        if (!results || results.data.length === 0 || results.data.results[refId].meta.rowCount === 0) {
            return [];
        }
        var columns = results.data.results[refId].tables[0].columns;
        var rows = results.data.results[refId].tables[0].rows;
        var textColIndex = this.findColIndex(columns, '__text');
        var valueColIndex = this.findColIndex(columns, '__value');
        if (columns.length === 2 && textColIndex !== -1 && valueColIndex !== -1) {
            return this.transformToKeyValueList(rows, textColIndex, valueColIndex);
        }
        return this.transformToSimpleList(rows);
    };
    ResponseParser.prototype.transformToKeyValueList = function (rows, textColIndex, valueColIndex) {
        var res = [];
        for (var i = 0; i < rows.length; i++) {
            if (!this.containsKey(res, rows[i][textColIndex])) {
                res.push({
                    text: rows[i][textColIndex],
                    value: rows[i][valueColIndex],
                });
            }
        }
        return res;
    };
    ResponseParser.prototype.transformToSimpleList = function (rows) {
        var res = [];
        for (var i = 0; i < rows.length; i++) {
            for (var j = 0; j < rows[i].length; j++) {
                var value = rows[i][j];
                if (res.indexOf(value) === -1) {
                    res.push(value);
                }
            }
        }
        return _.map(res, function (value) {
            return { text: value };
        });
    };
    ResponseParser.prototype.findColIndex = function (columns, colName) {
        for (var i = 0; i < columns.length; i++) {
            if (columns[i].text === colName) {
                return i;
            }
        }
        return -1;
    };
    ResponseParser.prototype.containsKey = function (res, key) {
        for (var i = 0; i < res.length; i++) {
            if (res[i].text === key) {
                return true;
            }
        }
        return false;
    };
    ResponseParser.prototype.transformAnnotationResponse = function (options, data) {
        var table = data.data.results[options.annotation.name].tables[0];
        var timeColumnIndex = -1;
        var titleColumnIndex = -1;
        var textColumnIndex = -1;
        var tagsColumnIndex = -1;
        for (var i = 0; i < table.columns.length; i++) {
            if (table.columns[i].text === 'time') {
                timeColumnIndex = i;
            }
            else if (table.columns[i].text === 'text') {
                textColumnIndex = i;
            }
            else if (table.columns[i].text === 'tags') {
                tagsColumnIndex = i;
            }
        }
        if (timeColumnIndex === -1) {
            return this.$q.reject({
                message: 'Missing mandatory time column in annotation query.',
            });
        }
        var list = [];
        for (var i = 0; i < table.rows.length; i++) {
            var row = table.rows[i];
            list.push({
                annotation: options.annotation,
                time: Math.floor(row[timeColumnIndex]),
                title: row[titleColumnIndex],
                text: row[textColumnIndex],
                tags: row[tagsColumnIndex] ? row[tagsColumnIndex].trim().split(/\s*,\s*/) : [],
            });
        }
        return list;
    };
    return ResponseParser;
}());
export default ResponseParser;
//# sourceMappingURL=response_parser.js.map