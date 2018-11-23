import _ from 'lodash';
import { TimeSeries } from 'app/core/core';
import colors from 'app/core/utils/colors';

export enum LogLevel {
  crit = 'crit',
  warn = 'warn',
  err = 'error',
  error = 'error',
  info = 'info',
  debug = 'debug',
  trace = 'trace',
  none = 'none',
}

export const LogLevelColor = {
  [LogLevel.crit]: colors[7],
  [LogLevel.warn]: colors[1],
  [LogLevel.err]: colors[4],
  [LogLevel.error]: colors[4],
  [LogLevel.info]: colors[0],
  [LogLevel.debug]: colors[3],
  [LogLevel.trace]: colors[3],
  [LogLevel.none]: '#eee',
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
  labels: string;
  logLevel: LogLevel;
  searchWords?: string[];
  timestamp: string; // ISO with nanosec precision
  timeFromNow: string;
  timeEpochMs: number;
  timeLocal: string;
  uniqueLabels?: string;
}

export interface LogsMetaItem {
  label: string;
  value: string;
}

export interface LogsModel {
  meta?: LogsMetaItem[];
  rows: LogRow[];
  series?: TimeSeries[];
}

export interface LogsStream {
  labels: string;
  entries: LogsStreamEntry[];
  search?: string;
  parsedLabels?: LogsStreamLabels;
  uniqueLabels?: string;
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

export function makeSeriesForLogs(rows: LogRow[], intervalMs: number): TimeSeries[] {
  // Graph time series by log level
  const seriesByLevel = {};
  rows.forEach(row => {
    if (!seriesByLevel[row.logLevel]) {
      seriesByLevel[row.logLevel] = { lastTs: null, datapoints: [], alias: row.logLevel };
    }
    const levelSeries = seriesByLevel[row.logLevel];

    // Bucket to nearest minute
    const time = Math.round(row.timeEpochMs / intervalMs / 10) * intervalMs * 10;
    // Entry for time
    if (time === levelSeries.lastTs) {
      levelSeries.datapoints[levelSeries.datapoints.length - 1][0]++;
    } else {
      levelSeries.datapoints.push([1, time]);
      levelSeries.lastTs = time;
    }
  });

  return Object.keys(seriesByLevel).reduce((acc, level) => {
    if (seriesByLevel[level]) {
      const gs = new TimeSeries(seriesByLevel[level]);
      gs.setColor(LogLevelColor[level]);
      acc.push(gs);
    }
    return acc;
  }, []);
}
