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
