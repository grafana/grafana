import _ from 'lodash';
import { TimeSeries } from 'app/core/core';

export enum LogLevel {
  crit = 'crit',
  warn = 'warn',
  err = 'error',
  error = 'error',
  info = 'info',
  debug = 'debug',
  trace = 'trace',
}

export interface LogSearchMatch {
  start: number;
  length: number;
  text: string;
}

export interface LogRow {
  key: string;
  entry: string;
  labels: string;
  logLevel: LogLevel;
  timestamp: string;
  timeFromNow: string;
  timeJs: number;
  timeLocal: string;
  searchWords?: string[];
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
  parsedLabels: { [key: string]: string };
  graphSeries: TimeSeries;
}

export interface LogsStreamEntry {
  line: string;
  timestamp: string;
}
