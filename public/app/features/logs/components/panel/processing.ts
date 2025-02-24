import Prism from 'prismjs';

import { dateTimeFormat, LogLevel, LogRowModel, LogsSortOrder } from '@grafana/data';

import { escapeUnescapedString, sortLogRows } from '../../utils';
import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { FieldDef, getAllFields } from '../logParser';

import { getDisplayedFieldValue } from './LogLine';
import { GetFieldLinksFn } from './LogList';
import { logsGrammar } from './grammar';
import { measureTextWidth } from './virtualization';

export interface LogListModel extends LogRowModel {
  body: string;
  highlightedBody: string;
  displayLevel: string;
  fields: FieldDef[];
  timestamp: string;
}

export interface LogFieldDimension {
  field: string;
  width: number;
}

export interface PreProcessOptions {
  escape: boolean;
  getFieldLinks?: GetFieldLinksFn;
  order: LogsSortOrder;
  timeZone: string;
}

export const preProcessLogs = (
  logs: LogRowModel[],
  { escape, getFieldLinks, order, timeZone }: PreProcessOptions
): LogListModel[] => {
  const orderedLogs = sortLogRows(logs, order);
  return orderedLogs.map((log) => preProcessLog(log, { escape, getFieldLinks, timeZone }));
};

interface PreProcessLogOptions {
  escape: boolean;
  getFieldLinks?: GetFieldLinksFn;
  timeZone: string;
}
const preProcessLog = (
  log: LogRowModel,
  { escape, getFieldLinks, timeZone }: PreProcessLogOptions
): LogListModel => {
  let body = log.entry;
  const timestamp = dateTimeFormat(log.timeEpochMs, {
    timeZone,
    defaultWithMS: true,
  });

  if (escape && log.hasUnescapedContent) {
    body = escapeUnescapedString(body);
  }
  // Turn it into a single-line log entry for the list
  body = body.replace(/(\r\n|\n|\r)/g, '');

  const highlightedBody = Prism.highlight(body, logsGrammar, 'lokiql');

  return {
    ...log,
    body,
    highlightedBody,
    displayLevel: logLevelToDisplayLevel(log.logLevel),
    fields: getAllFields(log, getFieldLinks),
    timestamp,
  };
};

function logLevelToDisplayLevel(level = '') {
  switch (level) {
    case LogLevel.critical:
      return 'crit';
    case LogLevel.warning:
      return 'warn';
    case LogLevel.unknown:
      return '';
    default:
      return level;
  }
}

export const calculateFieldDimensions = (logs: LogListModel[], displayedFields: string[] = []) => {
  if (!logs.length) {
    return [];
  }
  let timestampWidth = 0;
  let levelWidth = 0;
  const fieldWidths: Record<string, number> = {};
  for (let i = 0; i < logs.length; i++) {
    let width = measureTextWidth(logs[i].timestamp);
    if (width > timestampWidth) {
      timestampWidth = Math.round(width);
    }
    width = measureTextWidth(logs[i].displayLevel);
    if (width > levelWidth) {
      levelWidth = Math.round(width);
    }
    for (const field of displayedFields) {
      width = measureTextWidth(getDisplayedFieldValue(field, logs[i]));
      fieldWidths[field] = !fieldWidths[field] || width > fieldWidths[field] ? Math.round(width) : fieldWidths[field];
    }
  }
  const dimensions: LogFieldDimension[] = [
    {
      field: 'timestamp',
      width: timestampWidth,
    },
    {
      field: 'level',
      width: levelWidth,
    },
  ];
  for (const field in fieldWidths) {
    // Skip the log line when it's a displayed field
    if (field === LOG_LINE_BODY_FIELD_NAME) {
      continue;
    }
    dimensions.push({
      field,
      width: fieldWidths[field],
    });
  }
  return dimensions;
};
