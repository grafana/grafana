import Prism, { Grammar } from 'prismjs';

import { DataFrame, dateTimeFormat, Labels, LogLevel, LogRowModel, LogsSortOrder } from '@grafana/data';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { escapeUnescapedString, sortLogRows } from '../../utils';
import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { FieldDef, getAllFields } from '../logParser';

import { generateLogGrammar } from './grammar';
import { getTruncationLength } from './virtualization';

export class LogListModel implements LogRowModel {
  datasourceType: string | undefined;
  dataFrame: DataFrame;
  duplicates: number | undefined;
  entry: string;
  entryFieldIndex: number;
  hasAnsi: boolean;
  hasUnescapedContent: boolean;
  labels: Labels;
  logLevel: LogLevel;
  raw: string;
  rowIndex: number;
  rowId?: string | undefined;
  searchWords: string[] | undefined;
  timeFromNow: string;
  timeEpochMs: number;
  timeEpochNs: string;
  timeLocal: string;
  timeUtc: string;
  uid: string;
  uniqueLabels: Labels | undefined;

  private _body: string | undefined = undefined;
  displayLevel: string;
  private grammar: Grammar;
  private _highlightedBody: string | undefined = undefined;
  fields: FieldDef[];
  timestamp: string;
  collapsed: boolean | undefined = undefined;

  constructor(log: LogRowModel, { escape, getFieldLinks, grammar, timeZone }: PreProcessLogOptions) {
    // LogRowModel
    this.datasourceType = log.datasourceType;
    this.dataFrame = log.dataFrame;
    this.duplicates = log.duplicates;
    this.entry = log.entry;
    this.entryFieldIndex = log.entryFieldIndex;
    this.hasAnsi = log.hasAnsi;
    this.hasUnescapedContent = log.hasUnescapedContent;
    this.labels = log.labels;
    this.logLevel = log.logLevel;
    this.rowIndex = log.rowIndex;
    this.rowId = log.rowId;
    this.searchWords = log.searchWords;
    this.timeFromNow = log.timeFromNow;
    this.timeEpochMs = log.timeEpochMs;
    this.timeEpochNs = log.timeEpochNs;
    this.timeLocal = log.timeLocal;
    this.timeUtc = log.timeUtc;
    this.uid = log.uid;
    this.uniqueLabels = log.uniqueLabels;

    // LogListModel
    this.displayLevel = logLevelToDisplayLevel(log.logLevel);
    this.fields = getAllFields(log, getFieldLinks);
    this.grammar = grammar ?? generateLogGrammar(this);
    this.timestamp = dateTimeFormat(log.timeEpochMs, {
      timeZone,
      defaultWithMS: true,
    });

    let raw = log.raw;
    if (escape && log.hasUnescapedContent) {
      raw = escapeUnescapedString(raw);
    }
    this.raw = raw;
  }

  get body(): string {
    if (this._body === undefined) {
      let body = this.collapsed ? this.raw.substring(0, getTruncationLength()) : this.raw;
      // Turn it into a single-line log entry for the list
      this._body = body.replace(/(\r\n|\n|\r)/g, '');
    }
    return this._body;
  }

  get highlightedBody() {
    if (this._highlightedBody === undefined) {
      this._highlightedBody = Prism.highlight(this.body, this.grammar, 'lokiql');
    }
    return this._highlightedBody;
  }

  getDisplayedFieldValue(fieldName: string): string {
    if (fieldName === LOG_LINE_BODY_FIELD_NAME) {
      return this.body;
    }
    if (this.labels[fieldName] != null) {
      return this.labels[fieldName];
    }
    const field = this.fields.find((field) => {
      return field.keys[0] === fieldName;
    });

    return field ? field.values.toString() : '';
  }

  checkCollapsedState(displayedFields: string[], container: HTMLDivElement | null) {
    const lineLength =
      displayedFields.map((field) => this.getDisplayedFieldValue(field)).join('').length + this.raw.length;
    const collapsed = lineLength >= getTruncationLength(container) ? true : undefined;
    if (this.collapsed === undefined || collapsed === undefined) {
      this.collapsed = collapsed;
    }
    return this.collapsed;
  }

  setCollapsedState(collapsed: boolean) {
    if (this.collapsed !== collapsed) {
      this._body = undefined;
      this._highlightedBody = undefined;
    }
    this.collapsed = collapsed;
  }
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
  return orderedLogs.map((log) => preProcessLog(log, { escape, getFieldLinks, grammar, timeZone }));
};

interface PreProcessLogOptions {
  escape: boolean;
  getFieldLinks?: GetFieldLinksFn;
  grammar?: Grammar;
  timeZone: string;
}
const preProcessLog = (log: LogRowModel, options: PreProcessLogOptions): LogListModel => {
  return new LogListModel(log, options);
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
