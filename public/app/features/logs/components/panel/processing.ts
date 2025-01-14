import { LogRowModel } from "@grafana/data";

export interface ProcessedLogModel extends LogRowModel {
  body: string;
}

interface PreProcessOptions {
  wrapLogMessage: boolean;
}

export const preProcessLogs = (logs: LogRowModel[], { wrapLogMessage}: PreProcessOptions): ProcessedLogModel[] => {
  return logs.map(log => ({
    ...log,
    body: restructureLog(log.entry, false, wrapLogMessage, false),
  }));
}

const restructureLog = (
  line: string,
  prettifyLogMessage: boolean,
  wrapLogMessage: boolean,
  expanded: boolean
): string => {
  if (prettifyLogMessage) {
    try {
      return JSON.stringify(JSON.parse(line), undefined, 2);
    } catch (error) {}
  }
  // With wrapping disabled, we want to turn it into a single-line log entry unless the line is expanded
  if (!wrapLogMessage && !expanded) {
    line = line.replace(/(\r\n|\n|\r)/g, '');
  }
  return line;
};
