///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';

declare var window: any;

export function exportDateAsTz(dt, offsetTz = null) {
    var d = (new Date(dt)).toISOString();
    // Maintain compatibility with current export functionality
    // which exports with 'Z', instead of +00:00 on the end of 
    // the string.
    if (offsetTz === null || offsetTz === '00:00') {
      return d;
    }

    return moment(d).utcOffset(offsetTz).format();
}

export function exportSeriesListToCsv(seriesList, tzOffset = null) {
    var text = 'sep=;\nSeries;Time;Value\n';
    _.each(seriesList, function(series) {
        _.each(series.datapoints, function(dp) {
            text += series.alias + ';' + exportDateAsTz(dp[1], tzOffset) + ';' + dp[0] + '\n';
        });
    });
    saveSaveBlob(text, 'grafana_data_export.csv');
};

export function exportSeriesListToCsvColumns(seriesList, tzOffset = null) {
    var text = 'sep=;\nTime;';
    // add header
    _.each(seriesList, function(series) {
        text += series.alias + ';';
    });
    text = text.substring(0,text.length-1);
    text += '\n';

    // process data
    var dataArr = [[]];
    var sIndex = 1;
    _.each(seriesList, function(series) {
        var cIndex = 0;
        dataArr.push([]);
        _.each(series.datapoints, function(dp) {
            dataArr[0][cIndex] = exportDateAsTz(dp[1], tzOffset);
            dataArr[sIndex][cIndex] = dp[0];
            cIndex++;
        });
        sIndex++;
    });

    // make text
    for (var i = 0; i < dataArr[0].length; i++) {
        text += dataArr[0][i] + ';';
        for (var j = 1; j < dataArr.length; j++) {
            text += dataArr[j][i] + ';';
        }
        text = text.substring(0,text.length-1);
        text += '\n';
    }
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
