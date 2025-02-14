import { dateTimeFormat, LogRowModel, LogsSortOrder } from '@grafana/data';

import { escapeUnescapedString, sortLogRows } from '../../utils';

import { measureTextWidth } from './virtualization';

export interface LogListModel extends LogRowModel {
  body: string;
  timestamp: string;
  dimensions: LogDimensions;
}

export interface LogDimensions {
  timestampWidth: number;
  levelWidth: number;
}

interface PreProcessOptions {
  escape: boolean;
  order: LogsSortOrder;
  timeZone: string;
  wrap: boolean;
}

export const preProcessLogs = (
  logs: LogRowModel[],
  { escape, order, timeZone, wrap }: PreProcessOptions
): LogListModel[] => {
  const orderedLogs = sortLogRows(logs, order);
  return orderedLogs.map((log) => preProcessLog(log, { wrap, escape, timeZone, expanded: false }));
};

interface PreProcessLogOptions {
  escape: boolean;
  expanded: boolean; // Not yet implemented
  timeZone: string;
  wrap: boolean;
}
const preProcessLog = (log: LogRowModel, { escape, expanded, timeZone, wrap }: PreProcessLogOptions): LogListModel => {
  let body = log.entry;
  const timestamp = dateTimeFormat(log.timeEpochMs, {
    timeZone,
    defaultWithMS: true,
  });

  if (escape && log.hasUnescapedContent) {
    body = escapeUnescapedString(body);
  }
  // With wrapping disabled, we want to turn it into a single-line log entry unless the line is expanded
  if (!wrap && !expanded) {
    body = body.replace(/(\r\n|\n|\r)/g, '');
  }

  return {
    ...log,
    body,
    timestamp,
    dimensions: {
      timestampWidth: measureTextWidth(timestamp),
      levelWidth: measureTextWidth(log.logLevel),
    },
  };
};
