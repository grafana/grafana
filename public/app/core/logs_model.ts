import _ from 'lodash';

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
  logLevel: LogLevel;
  timestamp: string;
  timeFromNow: string;
  timeLocal: string;
  searchWords?: string[];
}

export interface LogsModel {
  rows: LogRow[];
}

export function mergeStreams(streams: LogsModel[], limit?: number): LogsModel {
  const combinedEntries = streams.reduce((acc, stream) => {
    return [...acc, ...stream.rows];
  }, []);
  const sortedEntries = _.chain(combinedEntries)
    .sortBy('timestamp')
    .reverse()
    .slice(0, limit || combinedEntries.length)
    .value();
  return { rows: sortedEntries };
}
