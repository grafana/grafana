import _ from 'lodash';
import moment from 'moment';
import {saveAs} from 'file-saver';

const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';

export function exportSeriesListToCsv(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false, commaDelimited = false) {
    var delimiter = selectDelimiter(commaDelimited);
    var text = (excel ? 'sep=' + delimiter + '\n' : '') + 'Series' + delimiter + 'Time' + delimiter + 'Value\n';
    _.each(seriesList, function(series) {
        _.each(series.datapoints, function(dp) {
            text += series.alias + delimiter + moment(dp[1]).format(dateTimeFormat) + delimiter + dp[0] + '\n';
        });
    });
    saveSaveBlob(text, 'grafana_data_export.csv');
}

export function exportSeriesListToCsvColumns(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false, commaDelimited = false) {
    var delimiter = selectDelimiter(commaDelimited);
    var text = (excel ? 'sep=' + delimiter + '\n' : '') + 'Time' + delimiter;
    // add header
    _.each(seriesList, function(series) {
        text += series.alias + delimiter;
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
            dataArr[0][cIndex] = moment(dp[1]).format(dateTimeFormat);
            dataArr[sIndex][cIndex] = dp[0];
            cIndex++;
        });
        sIndex++;
    });

    // make text
    for (var i = 0; i < dataArr[0].length; i++) {
        text += dataArr[0][i] + delimiter;
        for (var j = 1; j < dataArr.length; j++) {
            text += dataArr[j][i] + delimiter;
        }
        text = text.substring(0,text.length-1);
        text += '\n';
    }
    saveSaveBlob(text, 'grafana_data_export.csv');
}

export function exportTableDataToCsv(table, excel = false, commaDelimited = false) {
  var delimiter = selectDelimiter(commaDelimited);
  var text = excel ? 'sep=' + delimiter +'\n' : '';

    // add header
    _.each(table.columns, function(column) {
        text += (column.title || column.text) + delimiter;
    });
    text += '\n';
    // process data
    _.each(table.rows, function(row) {
        _.each(row, function(value) {
            text += value + delimiter;
        });
        text += '\n';
    });
    saveSaveBlob(text, 'grafana_data_export.csv');
}

export function saveSaveBlob(payload, fname) {
    var blob = new Blob([payload], { type: "text/csv;charset=utf-8" });
    saveAs(blob, fname);
}

export function selectDelimiter(commaDelimited) {
  return commaDelimited ? ',' : ';';
}
