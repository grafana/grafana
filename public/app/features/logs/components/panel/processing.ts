import { LogRowModel, LogsSortOrder } from '@grafana/data';

import { escapeUnescapedString, sortLogRows } from '../../utils';

export interface ProcessedLogModel extends LogRowModel {
  body: string;
}

interface PreProcessOptions {
  escape: boolean;
  order: LogsSortOrder;
  wrap: boolean;
}

export const preProcessLogs = (
  logs: LogRowModel[],
  { escape, order, wrap }: PreProcessOptions
): ProcessedLogModel[] => {
  const orderedLogs = sortLogRows(logs, order);
  return orderedLogs.map((log) => restructureLog(log, { wrap, escape, prettify: false, expanded: false }));
};

interface RestructureLogOptions {
  escape: boolean;
  expanded: boolean;
  prettify: boolean;
  wrap: boolean;
}
const restructureLog = (
  log: LogRowModel,
  { prettify, wrap, expanded, escape }: RestructureLogOptions
): ProcessedLogModel => {
  const processedLog: ProcessedLogModel = { ...log, body: log.entry };
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
