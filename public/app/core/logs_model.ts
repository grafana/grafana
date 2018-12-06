import _ from 'lodash';
import { TimeSeries } from 'app/core/core';
import colors, { getThemeColor } from 'app/core/utils/colors';

export enum LogLevel {
  crit = 'critical',
  critical = 'critical',
  warn = 'warning',
  warning = 'warning',
  err = 'error',
  error = 'error',
  info = 'info',
  debug = 'debug',
  trace = 'trace',
  unkown = 'unkown',
}

export const LogLevelColor = {
  [LogLevel.critical]: colors[7],
  [LogLevel.warning]: colors[1],
  [LogLevel.error]: colors[4],
  [LogLevel.info]: colors[0],
  [LogLevel.debug]: colors[5],
  [LogLevel.trace]: colors[2],
  [LogLevel.unkown]: getThemeColor('#8e8e8e', '#dde4ed'),
};

export interface LogSearchMatch {
  start: number;
  length: number;
  text: string;
}

export interface LogRow {
  duplicates?: number;
  entry: string;
  key: string; // timestamp + labels
  labels: LogsStreamLabels;
  logLevel: LogLevel;
  searchWords?: string[];
  timestamp: string; // ISO with nanosec precision
  timeFromNow: string;
  timeEpochMs: number;
  timeLocal: string;
  uniqueLabels?: LogsStreamLabels;
}

export interface LogsLabelStat {
  active?: boolean;
  count: number;
  proportion: number;
  value: string;
}

export enum LogsMetaKind {
  Number,
  String,
  LabelsMap,
}

export interface LogsMetaItem {
  label: string;
  value: string | number | LogsStreamLabels;
  kind: LogsMetaKind;
}

export interface LogsModel {
  id: string; // Identify one logs result from another
  meta?: LogsMetaItem[];
  rows: LogRow[];
  series?: TimeSeries[];
}

export interface LogsStream {
  labels: string;
  entries: LogsStreamEntry[];
  search?: string;
  parsedLabels?: LogsStreamLabels;
  uniqueLabels?: LogsStreamLabels;
}

export interface LogsStreamEntry {
  line: string;
  timestamp: string;
}

export interface LogsStreamLabels {
  [key: string]: string;
}

export enum LogsDedupStrategy {
  none = 'none',
  exact = 'exact',
  numbers = 'numbers',
  signature = 'signature',
}

export function calculateLogsLabelStats(rows: LogRow[], label: string): LogsLabelStat[] {
  // Consider only rows that have the given label
  const rowsWithLabel = rows.filter(row => row.labels[label] !== undefined);
  const rowCount = rowsWithLabel.length;

  // Get label value counts for eligible rows
  const countsByValue = _.countBy(rowsWithLabel, row => (row as LogRow).labels[label]);
  const sortedCounts = _.chain(countsByValue)
    .map((count, value) => ({ count, value, proportion: count / rowCount }))
    .sortBy('count')
    .reverse()
    .value();

  return sortedCounts;
}

const isoDateRegexp = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-6]\d[,\.]\d+([+-][0-2]\d:[0-5]\d|Z)/g;
function isDuplicateRow(row: LogRow, other: LogRow, strategy: LogsDedupStrategy): boolean {
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

  const dedupedRows = logs.rows.reduce((result: LogRow[], row: LogRow, index, list) => {
    const previous = result[result.length - 1];
    if (index > 0 && isDuplicateRow(row, previous, strategy)) {
      previous.duplicates++;
    } else {
      row.duplicates = 0;
      result.push(row);
    }
    return result;
  }, []);

  return {
    ...logs,
    rows: dedupedRows,
  };
}

export function filterLogLevels(logs: LogsModel, hiddenLogLevels: Set<LogLevel>): LogsModel {
  if (hiddenLogLevels.size === 0) {
    return logs;
  }

  const filteredRows = logs.rows.reduce((result: LogRow[], row: LogRow, index, list) => {
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

export function makeSeriesForLogs(rows: LogRow[], intervalMs: number): TimeSeries[] {
  // currently interval is rangeMs / resolution, which is too low for showing series as bars.
  // need at least 10px per bucket, so we multiply interval by 10. Should be solved higher up the chain
  // when executing queries & interval calculated and not here but this is a temporary fix.
  // intervalMs = intervalMs * 10;

  // Graph time series by log level
  const seriesByLevel = {};
  const bucketSize = intervalMs * 10;

  for (const row of rows) {
    if (!seriesByLevel[row.logLevel]) {
      seriesByLevel[row.logLevel] = { lastTs: null, datapoints: [], alias: row.logLevel };
    }

    const levelSeries = seriesByLevel[row.logLevel];

    // Bucket to nearest minute
    const time = Math.round(row.timeEpochMs / bucketSize) * bucketSize;

    // Entry for time
    if (time === levelSeries.lastTs) {
      levelSeries.datapoints[levelSeries.datapoints.length - 1][0]++;
    } else {
      levelSeries.datapoints.push([1, time]);
      levelSeries.lastTs = time;
    }
  }

  return Object.keys(seriesByLevel).reduce((acc, level) => {
    if (seriesByLevel[level]) {
      const gs = new TimeSeries(seriesByLevel[level]);
      gs.setColor(LogLevelColor[level]);
      acc.push(gs);
    }
    return acc;
  }, []);
}
