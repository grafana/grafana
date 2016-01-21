///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';

declare var window: any;

export function exportSeriesListToCsv(seriesList) {
    var text = 'Series;Time;Value\n';
    _.each(seriesList, function(series) {
        _.each(series.datapoints, function(dp) {
            text += series.alias + ';' + new Date(dp[1]).toISOString() + ';' + dp[0] + '\n';
        });
    });
    saveSaveBlob(text, 'grafana_data_export.csv');
};

export function exportTableDataToCsv(table) {
    var text = '';
    // add header
    _.each(table.columns, function(column) {
        text += column.text + ';';
    });
    text += '\n';
    // process data
    _.each(table.rows, function(row) {
        _.each(row, function(value) {
            text += value + ';';
        });
        text += '\n';
    });
    saveSaveBlob(text, 'grafana_data_export.csv');
};

export function saveSaveBlob(payload, fname) {
    var blob = new Blob([payload], { type: "text/csv;charset=utf-8" });
    window.saveAs(blob, fname);
};

/*
export default function flatten(target, opts): any {
    opts = opts || {};

    var delimiter = opts.delimiter || '.';
    var maxDepth = opts.maxDepth || 3;
    var currentDepth = 1;
    var output = {};

    function step(object, prev) {
        Object.keys(object).forEach(function(key) {
            var value = object[key];
            var isarray = opts.safe && Array.isArray(value);
            var type = Object.prototype.toString.call(value);
            var isobject = type === "[object Object]";

            var newKey = prev ? prev + delimiter + key : key;

            if (!opts.maxDepth) {
                maxDepth = currentDepth + 1;
            }

            if (!isarray && isobject && Object.keys(value).length && currentDepth < maxDepth) {
                ++currentDepth;
                return step(value, newKey);
            }

            output[newKey] = value;
        });
    }

    step(target, null);

    return output;
}
*/