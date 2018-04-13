import _ from 'lodash';
import moment from 'moment';
import { saveAs } from 'file-saver';

const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';
const POINT_TIME_INDEX = 1;
const POINT_VALUE_INDEX = 0;

const COLUMN_END = ';';
const ROW_END = '\n';
const QUOTE = '"';
const EXPORT_FILENAME = 'grafana_data_export.csv';

function formatSpecialHeader(excel) {
  return excel ? `sep=${COLUMN_END}${ROW_END}` : '';
}

function stripLastCharacter(text) {
  return text.substr(0, text.length - 1);
}

export function convertSeriesListToCsv(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  let text = formatSpecialHeader(excel) + `Series${COLUMN_END}Time${COLUMN_END}Value${ROW_END}`;
  _.each(seriesList, function(series) {
    _.each(series.datapoints, function(dp) {
      text +=
        series.alias +
        COLUMN_END +
        moment(dp[POINT_TIME_INDEX]).format(dateTimeFormat) +
        COLUMN_END +
        dp[POINT_VALUE_INDEX] +
        ROW_END;
    });
  });
  return text;
}

export function exportSeriesListToCsv(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  let text = convertSeriesListToCsv(seriesList, dateTimeFormat, excel);
  saveSaveBlob(text, EXPORT_FILENAME);
}

export function convertSeriesListToCsvColumns(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  let text = formatSpecialHeader(excel) + `Time${COLUMN_END}`;
  // add header
  _.each(seriesList, function(series) {
    text += series.alias + COLUMN_END;
  });
  text = stripLastCharacter(text) + ROW_END;

  // process data
  seriesList = mergeSeriesByTime(seriesList);
  let dataArr = [[]];
  let sIndex = 1;
  _.each(seriesList, function(series) {
    let cIndex = 0;
    dataArr.push([]);
    _.each(series.datapoints, function(dp) {
      dataArr[0][cIndex] = moment(dp[POINT_TIME_INDEX]).format(dateTimeFormat);
      dataArr[sIndex][cIndex] = dp[POINT_VALUE_INDEX];
      cIndex++;
    });
    sIndex++;
  });

  // make text
  for (let i = 0; i < dataArr[0].length; i++) {
    text += dataArr[0][i] + COLUMN_END;
    for (let j = 1; j < dataArr.length; j++) {
      text += dataArr[j][i] + COLUMN_END;
    }
    text = stripLastCharacter(text) + ROW_END;
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
  saveSaveBlob(text, EXPORT_FILENAME);
}

export function convertTableDataToCsv(table, excel = false) {
  function escaped(text) {
    return text
      .replace(new RegExp(`(^|[^\\\\])${QUOTE}`, 'g'), (match, $1, offset, original) => $1 + '\\' + QUOTE)
      .replace(new RegExp(`(^|[^\\\\])${QUOTE}`, 'g'), (match, $1, offset, original) => $1 + '\\' + QUOTE)
      .replace(new RegExp(`(^|[^\\\\])\n`, 'g'), (match, $1, offset, original) => $1 + '\\n')
      .replace(new RegExp(`(^|[^\\\\])\n`, 'g'), (match, $1, offset, original) => $1 + '\\n')
      .replace(new RegExp(`(^|[^\\\\])\r`, 'g'), (match, $1, offset, original) => $1 + '\\r')
      .replace(new RegExp(`(^|[^\\\\])\r`, 'g'), (match, $1, offset, original) => $1 + '\\r');
  }

  let text = formatSpecialHeader(excel);
  // add header
  _.each(table.columns, function(column) {
    text += `${QUOTE}${escaped(column.title || column.text)}${QUOTE}${COLUMN_END}`;
  });
  text = stripLastCharacter(text) + ROW_END;

  // process data
  _.each(table.rows, function(row) {
    _.each(row, function(value) {
      if (_.isNumber(value) || _.isBoolean(value)) {
        text += `${value}${COLUMN_END}`;
      } else {
        text += `${QUOTE}${escaped(value)}${QUOTE}${COLUMN_END}`;
      }
    });
    text = stripLastCharacter(text) + ROW_END;
  });
  return stripLastCharacter(text);
}

export function exportTableDataToCsv(table, excel = false) {
  let text = convertTableDataToCsv(table, excel);
  saveSaveBlob(text, EXPORT_FILENAME);
}

export function saveSaveBlob(payload, fname) {
  let blob = new Blob([payload], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, fname);
}
