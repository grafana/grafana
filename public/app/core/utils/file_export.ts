import _ from 'lodash';
import moment from 'moment';
import { saveAs } from 'file-saver';

const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';
const POINT_TIME_INDEX = 1;
const POINT_VALUE_INDEX = 0;

export function convertSeriesListToCsv(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  var text = (excel ? 'sep=;\n' : '') + 'Series;Time;Value\n';
  _.each(seriesList, function(series) {
    _.each(series.datapoints, function(dp) {
      text +=
        series.alias + ';' + moment(dp[POINT_TIME_INDEX]).format(dateTimeFormat) + ';' + dp[POINT_VALUE_INDEX] + '\n';
    });
  });
  return text;
}

export function exportSeriesListToCsv(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  var text = convertSeriesListToCsv(seriesList, dateTimeFormat, excel);
  saveSaveBlob(text, 'grafana_data_export.csv');
}

export function convertSeriesListToCsvColumns(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  let text = (excel ? 'sep=;\n' : '') + 'Time;';
  // add header
  _.each(seriesList, function(series) {
    text += series.alias + ';';
  });
  text = text.substring(0, text.length - 1);
  text += '\n';

  // process data
  seriesList = mergeSeriesByTime(seriesList);
  var dataArr = [[]];
  var sIndex = 1;
  _.each(seriesList, function(series) {
    var cIndex = 0;
    dataArr.push([]);
    _.each(series.datapoints, function(dp) {
      dataArr[0][cIndex] = moment(dp[POINT_TIME_INDEX]).format(dateTimeFormat);
      dataArr[sIndex][cIndex] = dp[POINT_VALUE_INDEX];
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
    text = text.substring(0, text.length - 1);
    text += '\n';
  }

  return text;
}

/**
 * Collect all unique timestamps from series list and use it to fill
 * missing points by null.
 */
function mergeSeriesByTime(seriesList) {
  let timestamps = [];
  for (let i = 0; i < seriesList.length; i++) {
    let seriesPoints = seriesList[i].datapoints;
    for (let j = 0; j < seriesPoints.length; j++) {
      timestamps.push(seriesPoints[j][POINT_TIME_INDEX]);
    }
  }
  timestamps = _.sortedUniq(timestamps.sort());

  for (let i = 0; i < seriesList.length; i++) {
    let seriesPoints = seriesList[i].datapoints;
    let seriesTimestamps = _.map(seriesPoints, p => p[POINT_TIME_INDEX]);
    let extendedSeries = [];
    let pointIndex;
    for (let j = 0; j < timestamps.length; j++) {
      pointIndex = _.sortedIndexOf(seriesTimestamps, timestamps[j]);
      if (pointIndex !== -1) {
        extendedSeries.push(seriesPoints[pointIndex]);
      } else {
        extendedSeries.push([null, timestamps[j]]);
      }
    }
    seriesList[i].datapoints = extendedSeries;
  }
  return seriesList;
}

export function exportSeriesListToCsvColumns(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  let text = convertSeriesListToCsvColumns(seriesList, dateTimeFormat, excel);
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
  var blob = new Blob([payload], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, fname);
}
