import _ from 'lodash';
import moment from 'moment';
import {saveAs} from 'file-saver';

const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';

export function exportSeriesListToCsv(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
    var text = (excel ? 'sep=;\n' : '') + 'Series;Time;Value\n';
    _.each(seriesList, function(series) {
        _.each(series.datapoints, function(dp) {
            text += series.alias + ';' + moment(dp[1]).format(dateTimeFormat) + ';' + dp[0] + '\n';
        });
    });
    saveSaveBlob(text, 'grafana_data_export.csv');
}

export function exportSeriesListToCsvColumns(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
    var text = (excel ? 'sep=;\n' : '') + 'Time;';
    // add header
    _.each(seriesList, function(series) {
        text += series.alias + ';';
    });
    text = text.substring(0,text.length-1);
    text += '\n';

    // process data
    var dataArr = [[[]]];
    var timeArr = [];
    var sIndex = 1;
    var timeIndex = 0;
    _.each(seriesList, function(series) {
        var cIndex = 0;
        dataArr.push([]);
        _.each(series.datapoints, function(dp) {
            dataArr[sIndex].push([]);
            dataArr[sIndex][cIndex].push([]);
            dataArr[sIndex][cIndex][0] = dp[0];
            dataArr[sIndex][cIndex][1] = dp[1];
            timeArr[timeIndex] = dp[1];
            timeIndex++;
            cIndex++;
        });
        sIndex++;
    });

    // Merge and sort time points accross series.
    var timearray = _.sortBy(_.uniq(timeArr), [function(time) { return time; }]);

    // make text
    for (var i = 0; i < (timearray.length - 1); i++) {
        text += moment(timearray[i]).format(dateTimeFormat) + ';';
        for (var j = 1; j < dataArr.length; j++) {
            var reading = 'undefined;';
            for (var k = 0; k < dataArr[j].length; k++) {
              if (timearray[i] === dataArr[j][k][1]) {
                  reading = dataArr[j][k][0] + ';';
                  break;
              }
            }
            text += reading;
        }
        text = text.substring(0, text.length - 1);
        text += '\n';
    }
    saveSaveBlob(text, 'grafana_data_export.csv');
}

export function exportTableDataToCsv(table, excel = false) {
  var text = excel ? 'sep=;\n' : '';
    // add header
    _.each(table.columns, function(column) {
        text += (column.title || column.text) + ';';
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
}

export function saveSaveBlob(payload, fname) {
    var blob = new Blob([payload], { type: "text/csv;charset=utf-8" });
    saveAs(blob, fname);
}
