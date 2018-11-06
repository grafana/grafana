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
  intervalMs?: number;
}

export interface LogsStreamEntry {
  line: string;
  timestamp: string;
}
