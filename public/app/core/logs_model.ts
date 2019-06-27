import _ from 'lodash';
import ansicolor from 'vendor/ansicolor/ansicolor';

import {
  colors,
  TimeSeries,
  Labels,
  LogLevel,
  SeriesData,
  findCommonLabels,
  findUniqueLabels,
  getLogLevel,
  toLegacyResponseData,
  FieldCache,
  FieldType,
  getLogLevelFromKey,
  LogRowModel,
  LogsModel,
  LogsMetaItem,
  LogsMetaKind,
  LogsParser,
  LogLabelStatsModel,
  LogsDedupStrategy,
} from '@grafana/ui';
import { getThemeColor } from 'app/core/utils/colors';
import { hasAnsiCodes } from 'app/core/utils/text';
import { dateTime, toUtc } from '@grafana/ui/src/utils/moment_wrapper';

export const LogLevelColor = {
  [LogLevel.critical]: colors[7],
  [LogLevel.warning]: colors[1],
  [LogLevel.error]: colors[4],
  [LogLevel.info]: colors[0],
  [LogLevel.debug]: colors[5],
  [LogLevel.trace]: colors[2],
  [LogLevel.unknown]: getThemeColor('#8e8e8e', '#dde4ed'),
};

export enum LogsDedupDescription {
  none = 'No de-duplication',
  exact = 'De-duplication of successive lines that are identical, ignoring ISO datetimes.',
  numbers = 'De-duplication of successive lines that are identical when ignoring numbers, e.g., IP addresses, latencies.',
  signature = 'De-duplication of successive lines that have identical punctuation and whitespace.',
}
const LOGFMT_REGEXP = /(?:^|\s)(\w+)=("[^"]*"|\S+)/;

export const LogsParsers: { [name: string]: LogsParser } = {
  JSON: {
    buildMatcher: label => new RegExp(`(?:{|,)\\s*"${label}"\\s*:\\s*"?([\\d\\.]+|[^"]*)"?`),
    getFields: line => {
      const fields: string[] = [];
      try {
        const parsed = JSON.parse(line);
        _.map(parsed, (value, key) => {
          const fieldMatcher = new RegExp(`"${key}"\\s*:\\s*"?${_.escapeRegExp(JSON.stringify(value))}"?`);

          const match = line.match(fieldMatcher);
          if (match) {
            fields.push(match[0]);
          }
        });
      } catch {}
      return fields;
    },
    getLabelFromField: field => (field.match(/^"(\w+)"\s*:/) || [])[1],
    getValueFromField: field => (field.match(/:\s*(.*)$/) || [])[1],
    test: line => {
      try {
        return JSON.parse(line);
      } catch (error) {}
    },
  },

  logfmt: {
    buildMatcher: label => new RegExp(`(?:^|\\s)${label}=("[^"]*"|\\S+)`),
    getFields: line => {
      const fields: string[] = [];
      line.replace(new RegExp(LOGFMT_REGEXP, 'g'), substring => {
        fields.push(substring.trim());
        return '';
      });
      return fields;
    },
    getLabelFromField: field => (field.match(LOGFMT_REGEXP) || [])[1],
    getValueFromField: field => (field.match(LOGFMT_REGEXP) || [])[2],
    test: line => LOGFMT_REGEXP.test(line),
  },
};

export function calculateFieldStats(rows: LogRowModel[], extractor: RegExp): LogLabelStatsModel[] {
  // Consider only rows that satisfy the matcher
  const rowsWithField = rows.filter(row => extractor.test(row.entry));
  const rowCount = rowsWithField.length;

  // Get field value counts for eligible rows
  const countsByValue = _.countBy(rowsWithField, row => (row as LogRowModel).entry.match(extractor)[1]);
  const sortedCounts = _.chain(countsByValue)
    .map((count, value) => ({ count, value, proportion: count / rowCount }))
    .sortBy('count')
    .reverse()
    .value();

  return sortedCounts;
}

export function calculateLogsLabelStats(rows: LogRowModel[], label: string): LogLabelStatsModel[] {
  // Consider only rows that have the given label
  const rowsWithLabel = rows.filter(row => row.labels[label] !== undefined);
  const rowCount = rowsWithLabel.length;

  // Get label value counts for eligible rows
  const countsByValue = _.countBy(rowsWithLabel, row => (row as LogRowModel).labels[label]);
  const sortedCounts = _.chain(countsByValue)
    .map((count, value) => ({ count, value, proportion: count / rowCount }))
    .sortBy('count')
    .reverse()
    .value();

  return sortedCounts;
}

const isoDateRegexp = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-6]\d[,\.]\d+([+-][0-2]\d:[0-5]\d|Z)/g;
function isDuplicateRow(row: LogRowModel, other: LogRowModel, strategy: LogsDedupStrategy): boolean {
  switch (strategy) {
    case LogsDedupStrategy.exact:
      // Exact still strips dates
      return row.entry.replace(isoDateRegexp, '') === other.entry.replace(isoDateRegexp, '');

    case LogsDedupStrategy.numbers:
      return row.entry.replace(/\d/g, '') === other.entry.replace(/\d/g, '');

    case LogsDedupStrategy.signature:
      return row.entry.replace(/\w/g, '') === other.entry.replace(/\w/g, '');

    default:
      return false;
  }
}

export function dedupLogRows(logs: LogsModel, strategy: LogsDedupStrategy): LogsModel {
  if (strategy === LogsDedupStrategy.none) {
    return logs;
  }

  const dedupedRows = logs.rows.reduce((result: LogRowModel[], row: LogRowModel, index, list) => {
    const rowCopy = { ...row };
    const previous = result[result.length - 1];
    if (index > 0 && isDuplicateRow(row, previous, strategy)) {
      previous.duplicates++;
    } else {
      rowCopy.duplicates = 0;
      result.push(rowCopy);
    }
    return result;
  }, []);

  return {
    ...logs,
    rows: dedupedRows,
  };
}

export function getParser(line: string): LogsParser {
  let parser;
  try {
    if (LogsParsers.JSON.test(line)) {
      parser = LogsParsers.JSON;
    }
  } catch (error) {}
  if (!parser && LogsParsers.logfmt.test(line)) {
    parser = LogsParsers.logfmt;
  }
  return parser;
}

export function filterLogLevels(logs: LogsModel, hiddenLogLevels: Set<LogLevel>): LogsModel {
  if (hiddenLogLevels.size === 0) {
    return logs;
  }

  const filteredRows = logs.rows.reduce((result: LogRowModel[], row: LogRowModel, index, list) => {
    if (!hiddenLogLevels.has(row.logLevel)) {
      result.push(row);
    }
    return result;
  }, []);

  return {
    ...logs,
    rows: filteredRows,
  };
}

export function makeSeriesForLogs(rows: LogRowModel[], intervalMs: number): TimeSeries[] {
  // currently interval is rangeMs / resolution, which is too low for showing series as bars.
  // need at least 10px per bucket, so we multiply interval by 10. Should be solved higher up the chain
  // when executing queries & interval calculated and not here but this is a temporary fix.
  // intervalMs = intervalMs * 10;

  // Graph time series by log level
  const seriesByLevel: any = {};
  const bucketSize = intervalMs * 10;
  const seriesList: any[] = [];

  for (const row of rows) {
    let series = seriesByLevel[row.logLevel];

    if (!series) {
      seriesByLevel[row.logLevel] = series = {
        lastTs: null,
        datapoints: [],
        alias: row.logLevel,
        color: LogLevelColor[row.logLevel],
      };

      seriesList.push(series);
    }

    // align time to bucket size
    const time = Math.round(row.timeEpochMs / bucketSize) * bucketSize;

    // Entry for time
    if (time === series.lastTs) {
      series.datapoints[series.datapoints.length - 1][0]++;
    } else {
      series.datapoints.push([1, time]);
      series.lastTs = time;
    }

    // add zero to other levels to aid stacking so each level series has same number of points
    for (const other of seriesList) {
      if (other !== series && other.lastTs !== time) {
        other.datapoints.push([0, time]);
        other.lastTs = time;
      }
    }
  }

  return seriesList.map(series => {
    series.datapoints.sort((a: number[], b: number[]) => {
      return a[1] - b[1];
    });

    return {
      datapoints: series.datapoints,
      target: series.alias,
      alias: series.alias,
      color: series.color,
    };
  });
}

function isLogsData(series: SeriesData) {
  return series.fields.some(f => f.type === FieldType.time) && series.fields.some(f => f.type === FieldType.string);
}

export function seriesDataToLogsModel(seriesData: SeriesData[], intervalMs: number): LogsModel {
  const metricSeries: SeriesData[] = [];
  const logSeries: SeriesData[] = [];

  for (const series of seriesData) {
    if (isLogsData(series)) {
      logSeries.push(series);
      continue;
    }

    metricSeries.push(series);
  }

  const logsModel = logSeriesToLogsModel(logSeries);
  if (logsModel) {
    if (metricSeries.length === 0) {
      logsModel.series = makeSeriesForLogs(logsModel.rows, intervalMs);
    } else {
      logsModel.series = [];
      for (const series of metricSeries) {
        logsModel.series.push(toLegacyResponseData(series) as TimeSeries);
      }
    }

    return logsModel;
  }

  return {
    hasUniqueLabels: false,
    rows: [],
    meta: [],
    series: [],
  };
}

export function logSeriesToLogsModel(logSeries: SeriesData[]): LogsModel {
  if (logSeries.length === 0) {
    return undefined;
  }

  const allLabels: Labels[] = [];
  for (let n = 0; n < logSeries.length; n++) {
    const series = logSeries[n];
    if (series.labels) {
      allLabels.push(series.labels);
    }
  }

  let commonLabels: Labels = {};
  if (allLabels.length > 0) {
    commonLabels = findCommonLabels(allLabels);
  }

  const rows: LogRowModel[] = [];
  let hasUniqueLabels = false;

  for (let i = 0; i < logSeries.length; i++) {
    const series = logSeries[i];
    const fieldCache = new FieldCache(series.fields);
    const uniqueLabels = findUniqueLabels(series.labels, commonLabels);
    if (Object.keys(uniqueLabels).length > 0) {
      hasUniqueLabels = true;
    }

    for (let j = 0; j < series.rows.length; j++) {
      rows.push(processLogSeriesRow(series, fieldCache, j, uniqueLabels));
    }
  }

  const sortedRows = rows.sort((a, b) => {
    return a.timestamp > b.timestamp ? -1 : 1;
  });

  // Meta data to display in status
  const meta: LogsMetaItem[] = [];
  if (_.size(commonLabels) > 0) {
    meta.push({
      label: 'Common labels',
      value: commonLabels,
      kind: LogsMetaKind.LabelsMap,
    });
  }

  const limits = logSeries.filter(series => series.meta && series.meta.limit);

  if (limits.length > 0) {
    meta.push({
      label: 'Limit',
      value: `${limits[0].meta.limit} (${sortedRows.length} returned)`,
      kind: LogsMetaKind.String,
    });
  }

  return {
    hasUniqueLabels,
    meta,
    rows: sortedRows,
  };
}

export function processLogSeriesRow(
  series: SeriesData,
  fieldCache: FieldCache,
  rowIndex: number,
  uniqueLabels: Labels
): LogRowModel {
  const row = series.rows[rowIndex];
  const timeFieldIndex = fieldCache.getFirstFieldOfType(FieldType.time).index;
  const ts = row[timeFieldIndex];
  const stringFieldIndex = fieldCache.getFirstFieldOfType(FieldType.string).index;
  const message = row[stringFieldIndex];
  const time = dateTime(ts);
  const timeEpochMs = time.valueOf();
  const timeFromNow = time.fromNow();
  const timeLocal = time.format('YYYY-MM-DD HH:mm:ss');
  const timeUtc = toUtc(ts).format('YYYY-MM-DD HH:mm:ss');

  let logLevel = LogLevel.unknown;
  const logLevelField = fieldCache.getFieldByName('level');

  if (logLevelField) {
    logLevel = getLogLevelFromKey(row[logLevelField.index]);
  } else if (series.labels && Object.keys(series.labels).indexOf('level') !== -1) {
    logLevel = getLogLevelFromKey(series.labels['level']);
  } else {
    logLevel = getLogLevel(message);
  }
  const hasAnsi = hasAnsiCodes(message);
  const searchWords = series.meta && series.meta.searchWords ? series.meta.searchWords : [];

  return {
    logLevel,
    timeFromNow,
    timeEpochMs,
    timeLocal,
    timeUtc,
    uniqueLabels,
    hasAnsi,
    searchWords,
    entry: hasAnsi ? ansicolor.strip(message) : message,
    raw: message,
    labels: series.labels,
    timestamp: ts,
  };
}
