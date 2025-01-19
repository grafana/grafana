import { dateTimeFormat, LogRowModel, LogsSortOrder } from '@grafana/data';

import { escapeUnescapedString, sortLogRows } from '../../utils';

export interface ProcessedLogModel extends LogRowModel {
  body: string;
  timestamp: string;
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
): ProcessedLogModel[] => {
  const orderedLogs = sortLogRows(logs, order);
  return orderedLogs.map((log) => preProcessLog(log, { wrap, escape, timeZone, prettify: false, expanded: false }));
};

interface PreProcessLogOptions {
  escape: boolean;
  expanded: boolean;
  prettify: boolean;
  timeZone: string;
  wrap: boolean;
}
const preProcessLog = (
  log: LogRowModel,
  { escape, expanded, timeZone, prettify, wrap }: PreProcessLogOptions
): ProcessedLogModel => {
  const processedLog: ProcessedLogModel = {
    ...log,
    body: log.entry,
    timestamp: dateTimeFormat(log.timeEpochMs, {
      timeZone,
      defaultWithMS: true,
    }),
  };

  if (prettify) {
    try {
      processedLog.body = JSON.stringify(JSON.parse(processedLog.body), undefined, 2);
    } catch (error) {}
  }
  if (escape && log.hasUnescapedContent) {
    processedLog.body = escapeUnescapedString(processedLog.body);
  }
  // With wrapping disabled, we want to turn it into a single-line log entry unless the line is expanded
  if (!wrap && !expanded) {
    processedLog.body = processedLog.body.replace(/(\r\n|\n|\r)/g, '');
  }
  return processedLog;
};
