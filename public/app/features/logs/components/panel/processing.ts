import Prism, { Grammar } from 'prismjs';

import { dateTimeFormat, LogLevel, LogRowModel, LogsSortOrder } from '@grafana/data';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { escapeUnescapedString, sortLogRows } from '../../utils';
import { FieldDef, getAllFields } from '../logParser';

import { generateLogGrammar } from './grammar';

export interface LogListModel extends LogRowModel {
  body: string;
  _highlightedBody: string;
  highlightedBody: string;
  displayLevel: string;
  fields: FieldDef[];
  timestamp: string;
}

export interface PreProcessOptions {
  escape: boolean;
  getFieldLinks?: GetFieldLinksFn;
  order: LogsSortOrder;
  timeZone: string;
}

export const preProcessLogs = (
  logs: LogRowModel[],
  { escape, getFieldLinks, order, timeZone }: PreProcessOptions,
  grammar?: Grammar
): LogListModel[] => {
  const orderedLogs = sortLogRows(logs, order);
  return orderedLogs.map((log) => preProcessLog(log, { escape, getFieldLinks, timeZone }, grammar));
};

interface PreProcessLogOptions {
  escape: boolean;
  getFieldLinks?: GetFieldLinksFn;
  timeZone: string;
}
const preProcessLog = (
  log: LogRowModel,
  { escape, getFieldLinks, timeZone }: PreProcessLogOptions,
  grammar?: Grammar
): LogListModel => {
  let body = log.raw;
  const timestamp = dateTimeFormat(log.timeEpochMs, {
    timeZone,
    defaultWithMS: true,
  });

  if (escape && log.hasUnescapedContent) {
    body = escapeUnescapedString(body);
  }
  // Turn it into a single-line log entry for the list
  body = body.replace(/(\r\n|\n|\r)/g, '');

  return {
    ...log,
    body,
    _highlightedBody: '',
    get highlightedBody() {
      if (!this._highlightedBody) {
        this._highlightedBody = Prism.highlight(body, grammar ? grammar : generateLogGrammar(this), 'lokiql');
      }
      return this._highlightedBody;
    },
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
