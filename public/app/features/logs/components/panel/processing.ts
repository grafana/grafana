import { LogRowModel } from '@grafana/data';

import { escapeUnescapedString } from '../../utils';

export interface ProcessedLogModel extends LogRowModel {
  body: string;
}

interface PreProcessOptions {
  wrap: boolean;
  escape: boolean;
}

export const preProcessLogs = (logs: LogRowModel[], { wrap, escape }: PreProcessOptions): ProcessedLogModel[] => {
  return logs.map((log) => restructureLog(log, { wrap, escape, prettify: false, expanded: false }));
};

interface RestructureLogOptions extends PreProcessOptions {
  expanded: boolean;
  prettify: boolean;
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
