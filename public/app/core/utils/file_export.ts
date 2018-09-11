import { isBoolean, isNumber, sortedUniq, sortedIndexOf, unescape as htmlUnescaped } from 'lodash';
import moment from 'moment';
import { saveAs } from 'file-saver';
import { isNullOrUndefined } from 'util';

const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';
const POINT_TIME_INDEX = 1;
const POINT_VALUE_INDEX = 0;

const END_COLUMN = ';';
const END_ROW = '\r\n';
const QUOTE = '"';
const EXPORT_FILENAME = 'grafana_data_export.csv';

function csvEscaped(text) {
  if (!text) {
    return text;
  }

  return text.split(QUOTE).join(QUOTE + QUOTE);
}

const domParser = new DOMParser();
function htmlDecoded(text) {
  if (!text) {
    return text;
  }

  const regexp = /&[^;]+;/g;
  function htmlDecoded(value) {
    const parsedDom = domParser.parseFromString(value, 'text/html');
    return parsedDom.body.textContent;
  }
  return text.replace(regexp, htmlDecoded).replace(regexp, htmlDecoded);
}

function formatSpecialHeader(useExcelHeader) {
  return useExcelHeader ? `sep=${END_COLUMN}${END_ROW}` : '';
}

function formatRow(row, addEndRowDelimiter = true) {
  let text = '';
  for (let i = 0; i < row.length; i += 1) {
    if (isBoolean(row[i]) || isNullOrUndefined(row[i])) {
      text += row[i];
    } else if (isNumber(row[i])) {
      text += row[i].toLocaleString();
    } else {
      text += `${QUOTE}${csvEscaped(htmlUnescaped(htmlDecoded(row[i])))}${QUOTE}`;
    }

    if (i < row.length - 1) {
      text += END_COLUMN;
    }
  }
  return addEndRowDelimiter ? text + END_ROW : text;
}

export function convertSeriesListToCsv(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  let text = formatSpecialHeader(excel) + formatRow(['Series', 'Time', 'Value']);
  for (let seriesIndex = 0; seriesIndex < seriesList.length; seriesIndex += 1) {
    for (let i = 0; i < seriesList[seriesIndex].datapoints.length; i += 1) {
      text += formatRow(
        [
          seriesList[seriesIndex].alias,
          moment(seriesList[seriesIndex].datapoints[i][POINT_TIME_INDEX]).format(dateTimeFormat),
          seriesList[seriesIndex].datapoints[i][POINT_VALUE_INDEX],
        ],
        i < seriesList[seriesIndex].datapoints.length - 1 || seriesIndex < seriesList.length - 1
      );
    }
  }
  return text;
}

export function exportSeriesListToCsv(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  const text = convertSeriesListToCsv(seriesList, dateTimeFormat, excel);
  saveSaveBlob(text, EXPORT_FILENAME);
}

export function convertSeriesListToCsvColumns(seriesList, dateTimeFormat = DEFAULT_DATETIME_FORMAT, excel = false) {
  // add header
  let text =
    formatSpecialHeader(excel) +
    formatRow(
      ['Time'].concat(
        seriesList.map(val => {
          return val.alias;
        })
      )
    );
  // process data
  seriesList = mergeSeriesByTime(seriesList);

  // make text
  for (let i = 0; i < seriesList[0].datapoints.length; i += 1) {
    const timestamp = moment(seriesList[0].datapoints[i][POINT_TIME_INDEX]).format(dateTimeFormat);
    text += formatRow(
      [timestamp].concat(
        seriesList.map(series => {
          return series.datapoints[i][POINT_VALUE_INDEX];
        })
      ),
      i < seriesList[0].datapoints.length - 1
    );
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
    const seriesPoints = seriesList[i].datapoints;
    for (let j = 0; j < seriesPoints.length; j++) {
      timestamps.push(seriesPoints[j][POINT_TIME_INDEX]);
    }
  }
  timestamps = sortedUniq(timestamps.sort());

  for (let i = 0; i < seriesList.length; i++) {
    const seriesPoints = seriesList[i].datapoints;
    const seriesTimestamps = seriesPoints.map(p => p[POINT_TIME_INDEX]);
    const extendedSeries = [];
    let pointIndex;
    for (let j = 0; j < timestamps.length; j++) {
      pointIndex = sortedIndexOf(seriesTimestamps, timestamps[j]);
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
  const text = convertSeriesListToCsvColumns(seriesList, dateTimeFormat, excel);
  saveSaveBlob(text, EXPORT_FILENAME);
}

export function convertTableDataToCsv(table, excel = false) {
  let text = formatSpecialHeader(excel);
  // add headline
  text += formatRow(table.columns.map(val => val.title || val.text));
  // process data
  for (let i = 0; i < table.rows.length; i += 1) {
    text += formatRow(table.rows[i], i < table.rows.length - 1);
  }
  return text;
}

export function exportTableDataToCsv(table, excel = false) {
  const text = convertTableDataToCsv(table, excel);
  saveSaveBlob(text, EXPORT_FILENAME);
}

export function saveSaveBlob(payload, fname) {
  const blob = new Blob([payload], { type: 'text/csv;charset=utf-8;header=present;' });
  saveAs(blob, fname);
}
