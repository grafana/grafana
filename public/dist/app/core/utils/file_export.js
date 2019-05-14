import { isBoolean, isNumber, sortedUniq, sortedIndexOf, unescape as htmlUnescaped } from 'lodash';
import moment from 'moment';
import { saveAs } from 'file-saver';
import { isNullOrUndefined } from 'util';
var DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';
var POINT_TIME_INDEX = 1;
var POINT_VALUE_INDEX = 0;
var END_COLUMN = ';';
var END_ROW = '\r\n';
var QUOTE = '"';
var EXPORT_FILENAME = 'grafana_data_export.csv';
function csvEscaped(text) {
    if (!text) {
        return text;
    }
    return text.split(QUOTE).join(QUOTE + QUOTE);
}
var domParser = new DOMParser();
function htmlDecoded(text) {
    if (!text) {
        return text;
    }
    var regexp = /&[^;]+;/g;
    function htmlDecoded(value) {
        var parsedDom = domParser.parseFromString(value, 'text/html');
        return parsedDom.body.textContent;
    }
    return text.replace(regexp, htmlDecoded).replace(regexp, htmlDecoded);
}
function formatSpecialHeader(useExcelHeader) {
    return useExcelHeader ? "sep=" + END_COLUMN + END_ROW : '';
}
function formatRow(row, addEndRowDelimiter) {
    if (addEndRowDelimiter === void 0) { addEndRowDelimiter = true; }
    var text = '';
    for (var i = 0; i < row.length; i += 1) {
        if (isBoolean(row[i]) || isNumber(row[i]) || isNullOrUndefined(row[i])) {
            text += row[i];
        }
        else {
            text += "" + QUOTE + csvEscaped(htmlUnescaped(htmlDecoded(row[i]))) + QUOTE;
        }
        if (i < row.length - 1) {
            text += END_COLUMN;
        }
    }
    return addEndRowDelimiter ? text + END_ROW : text;
}
export function convertSeriesListToCsv(seriesList, dateTimeFormat, excel) {
    if (dateTimeFormat === void 0) { dateTimeFormat = DEFAULT_DATETIME_FORMAT; }
    if (excel === void 0) { excel = false; }
    var text = formatSpecialHeader(excel) + formatRow(['Series', 'Time', 'Value']);
    for (var seriesIndex = 0; seriesIndex < seriesList.length; seriesIndex += 1) {
        for (var i = 0; i < seriesList[seriesIndex].datapoints.length; i += 1) {
            text += formatRow([
                seriesList[seriesIndex].alias,
                moment(seriesList[seriesIndex].datapoints[i][POINT_TIME_INDEX]).format(dateTimeFormat),
                seriesList[seriesIndex].datapoints[i][POINT_VALUE_INDEX],
            ], i < seriesList[seriesIndex].datapoints.length - 1 || seriesIndex < seriesList.length - 1);
        }
    }
    return text;
}
export function exportSeriesListToCsv(seriesList, dateTimeFormat, excel) {
    if (dateTimeFormat === void 0) { dateTimeFormat = DEFAULT_DATETIME_FORMAT; }
    if (excel === void 0) { excel = false; }
    var text = convertSeriesListToCsv(seriesList, dateTimeFormat, excel);
    saveSaveBlob(text, EXPORT_FILENAME);
}
export function convertSeriesListToCsvColumns(seriesList, dateTimeFormat, excel) {
    if (dateTimeFormat === void 0) { dateTimeFormat = DEFAULT_DATETIME_FORMAT; }
    if (excel === void 0) { excel = false; }
    // add header
    var text = formatSpecialHeader(excel) +
        formatRow(['Time'].concat(seriesList.map(function (val) {
            return val.alias;
        })));
    // process data
    var extendedDatapointsList = mergeSeriesByTime(seriesList);
    var _loop_1 = function (i) {
        var timestamp = moment(extendedDatapointsList[0][i][POINT_TIME_INDEX]).format(dateTimeFormat);
        text += formatRow([timestamp].concat(extendedDatapointsList.map(function (datapoints) {
            return datapoints[i][POINT_VALUE_INDEX];
        })), i < extendedDatapointsList[0].length - 1);
    };
    // make text
    for (var i = 0; i < extendedDatapointsList[0].length; i += 1) {
        _loop_1(i);
    }
    return text;
}
/**
 * Collect all unique timestamps from series list and use it to fill
 * missing points by null.
 */
function mergeSeriesByTime(seriesList) {
    var timestamps = [];
    for (var i = 0; i < seriesList.length; i++) {
        var seriesPoints = seriesList[i].datapoints;
        for (var j = 0; j < seriesPoints.length; j++) {
            timestamps.push(seriesPoints[j][POINT_TIME_INDEX]);
        }
    }
    timestamps = sortedUniq(timestamps.sort());
    var result = [];
    for (var i = 0; i < seriesList.length; i++) {
        var seriesPoints = seriesList[i].datapoints;
        var seriesTimestamps = seriesPoints.map(function (p) { return p[POINT_TIME_INDEX]; });
        var extendedDatapoints = [];
        for (var j = 0; j < timestamps.length; j++) {
            var timestamp = timestamps[j];
            var pointIndex = sortedIndexOf(seriesTimestamps, timestamp);
            if (pointIndex !== -1) {
                extendedDatapoints.push(seriesPoints[pointIndex]);
            }
            else {
                extendedDatapoints.push([null, timestamp]);
            }
        }
        result.push(extendedDatapoints);
    }
    return result;
}
export function exportSeriesListToCsvColumns(seriesList, dateTimeFormat, excel) {
    if (dateTimeFormat === void 0) { dateTimeFormat = DEFAULT_DATETIME_FORMAT; }
    if (excel === void 0) { excel = false; }
    var text = convertSeriesListToCsvColumns(seriesList, dateTimeFormat, excel);
    saveSaveBlob(text, EXPORT_FILENAME);
}
export function convertTableDataToCsv(table, excel) {
    if (excel === void 0) { excel = false; }
    var text = formatSpecialHeader(excel);
    // add headline
    text += formatRow(table.columns.map(function (val) { return val.title || val.text; }));
    // process data
    for (var i = 0; i < table.rows.length; i += 1) {
        text += formatRow(table.rows[i], i < table.rows.length - 1);
    }
    return text;
}
export function exportTableDataToCsv(table, excel) {
    if (excel === void 0) { excel = false; }
    var text = convertTableDataToCsv(table, excel);
    saveSaveBlob(text, EXPORT_FILENAME);
}
export function saveSaveBlob(payload, fname) {
    var blob = new Blob([payload], { type: 'text/csv;charset=utf-8;header=present;' });
    saveAs(blob, fname);
}
//# sourceMappingURL=file_export.js.map