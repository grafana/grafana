import { dateTimeFormat, LogRowModel, LogsSortOrder } from '@grafana/data';

import { escapeUnescapedString, sortLogRows } from '../../utils';
import { FieldDef, getAllFields } from '../logParser';

import { GetFieldLinksFn } from './LogList';
import { measureTextWidth } from './virtualization';

export interface LogListModel extends LogRowModel {
  body: string;
  fields: FieldDef[];
  timestamp: string;
  dimensions: LogDimension[];
}

export interface LogDimension {
  field: string;
  width: number;
}

interface PreProcessOptions {
  escape: boolean;
  getFieldLinks?: GetFieldLinksFn;
  order: LogsSortOrder;
  timeZone: string;
  wrap: boolean;
}

export const preProcessLogs = (
  logs: LogRowModel[],
  { escape, getFieldLinks, order, timeZone, wrap }: PreProcessOptions
): LogListModel[] => {
  const orderedLogs = sortLogRows(logs, order);
  const processedLogs = orderedLogs.map((log) =>
    preProcessLog(log, { escape, expanded: false, getFieldLinks, timeZone, wrap })
  );
  const dimensions = calculateFieldDimensions(processedLogs);
  processedLogs.forEach((log) => (log.dimensions = dimensions));
  return processedLogs;
};

interface PreProcessLogOptions {
  escape: boolean;
  expanded: boolean; // Not yet implemented
  getFieldLinks?: GetFieldLinksFn;
  timeZone: string;
  wrap: boolean;
}
const preProcessLog = (
  log: LogRowModel,
  { escape, expanded, getFieldLinks, timeZone, wrap }: PreProcessLogOptions
): LogListModel => {
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
    fields: getAllFields(log, getFieldLinks),
    timestamp,
    dimensions: [],
  };
};

export const calculateFieldDimensions = (logs: LogListModel[], displayedFields: string[] = []) => {
  if (!logs.length) {
    return [];
  }
  let timestampWidth = 0;
  let levelWidth = 0;
  for (let i = 0; i < logs.length; i++) {
    let width = measureTextWidth(logs[i].timestamp);
    if (width > timestampWidth) {
      timestampWidth = Math.round(width);
    }
    width = measureTextWidth(logs[i].logLevel);
    if (width > levelWidth) {
      levelWidth = Math.round(width);
    }
  }
  const dimensions: LogDimension[] = [
    {
      field: 'timestamp',
      width: timestampWidth,
    },
    {
      field: 'level',
      width: levelWidth,
    },
  ];
  return dimensions;
};
