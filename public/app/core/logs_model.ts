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
  text?: string;
}

export interface LogRow {
  key: string;
  entry: string;
  logLevel: LogLevel;
  timestamp: string;
  timeFromNow: string;
  timeLocal: string;
  searchMatches?: LogSearchMatch[];
}

export interface LogsModel {
  rows: LogRow[];
}
