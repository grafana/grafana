import ansicolor from 'ansicolor';
import { parse, stringify } from 'lossless-json';
import Prism, { Grammar } from 'prismjs';

import {
  DataFrame,
  dateTimeFormat,
  Labels,
  LogLevel,
  LogRowModel,
  LogsSortOrder,
  systemDateFormats,
  textUtil,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { checkLogsError, checkLogsSampled, escapeUnescapedString, sortLogRows } from '../../utils';
import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { FieldDef, getAllFields } from '../logParser';
import { identifyOTelLanguage, getOtelFormattedBody } from '../otel/formats';

import { generateLogGrammar, generateTextMatchGrammar } from './grammar';
import { LogLineVirtualization } from './virtualization';

const TRUNCATION_DEFAULT_LENGTH = 50000;
const NEWLINES_REGEX = /(\r\n|\n|\r)/g;

export class LogListModel implements LogRowModel {
  collapsed: boolean | undefined = undefined;
  datasourceType: string | undefined;
  dataFrame: DataFrame;
  datasourceUid?: string;
  displayLevel: string;
  duplicates: number | undefined;
  entry: string;
  entryFieldIndex: number;
  hasAnsi: boolean;
  hasError: boolean;
  hasUnescapedContent: boolean;
  isSampled: boolean;
  labels: Labels;
  logLevel: LogLevel;
  otelLanguage?: string;
  raw: string;
  rowIndex: number;
  rowId?: string | undefined;
  searchWords: string[] | undefined;
  timestamp: string;
  timeFromNow: string;
  timeEpochMs: number;
  timeEpochNs: string;
  timeLocal: string;
  timeUtc: string;
  uid: string;
  uniqueLabels: Labels | undefined;

  private _body: string | undefined = undefined;
  private _currentSearch: string | undefined = undefined;
  private _grammar?: Grammar;
  private _highlightedBody: string | undefined = undefined;
  private _fields: FieldDef[] | undefined = undefined;
  private _getFieldLinks: GetFieldLinksFn | undefined = undefined;
  private _virtualization?: LogLineVirtualization;
  private _wrapLogMessage: boolean;
  private _json = false;

  constructor(
    log: LogRowModel,
    { escape, getFieldLinks, grammar, timeZone, virtualization, wrapLogMessage }: PreProcessLogOptions
  ) {
    // LogRowModel
    this.datasourceType = log.datasourceType;
    this.dataFrame = log.dataFrame;
    this.datasourceUid = log.datasourceUid;
    this.duplicates = log.duplicates;
    this.entry = log.entry;
    this.entryFieldIndex = log.entryFieldIndex;
    this.hasAnsi = log.hasAnsi;
    this.hasError = !!checkLogsError(log);
    this.hasUnescapedContent = log.hasUnescapedContent;
    this.isSampled = !!checkLogsSampled(log);
    this.labels = log.labels;
    this.logLevel = log.logLevel;
    this.otelLanguage = identifyOTelLanguage(log);
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
    this._getFieldLinks = getFieldLinks;
    this._grammar = grammar;
    this.timestamp = dateTimeFormat(log.timeEpochMs, {
      timeZone,
      // YYYY-MM-DD HH:mm:ss.SSS
      format: systemDateFormats.fullDateMS,
    });
    this._virtualization = virtualization;
    this._wrapLogMessage = wrapLogMessage;

    let raw = log.raw;
    if (escape && log.hasUnescapedContent) {
      raw = escapeUnescapedString(raw);
    }
    this.raw = raw;
  }

  clone() {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    // Unless this function is required outside of <LogLineDetailsLog />, we create a wrapped clone, so new lines are not stripped.
    clone._wrapLogMessage = true;
    clone._body = undefined;
    clone._highlightedBody = undefined;
    return clone;
  }

  get body(): string {
    if (this._body === undefined) {
      try {
        const parsed = parse(this.raw);
        if (typeof parsed === 'object') {
          this._json = true; 
        }
        const reStringified = this._wrapLogMessage ? stringify(parsed, undefined, 2) : this.raw;
        if (reStringified) {
          this.raw = reStringified;
        }
      } catch (error) {}
      const raw = config.featureToggles.otelLogsFormatting && this.otelLanguage ? getOtelFormattedBody(this) : this.raw;
      this._body = this.collapsed
        ? raw.substring(0, this._virtualization?.getTruncationLength(null) ?? TRUNCATION_DEFAULT_LENGTH)
        : raw;
      if (!this._wrapLogMessage) {
        this._body = this._body.replace(NEWLINES_REGEX, '');
      }
    }
    return this._body;
  }

  get errorMessage(): string | undefined {
    return checkLogsError(this);
  }

  get fields(): FieldDef[] {
    if (this._fields === undefined) {
      this._fields = getAllFields(this, this._getFieldLinks);
    }
    return this._fields;
  }

  get highlightedBody() {
    if (this._highlightedBody === undefined) {
      this._grammar = this._grammar ?? generateLogGrammar(this);
      const extraGrammar = generateTextMatchGrammar(this.searchWords, this._currentSearch);
      this._highlightedBody = Prism.highlight(
        textUtil.sanitize(this.body),
        { ...extraGrammar, ...this._grammar },
        'lokiql'
      );
    }
    return this._highlightedBody;
  }

  get sampledMessage(): string | undefined {
    return checkLogsSampled(this);
  }

  get timestampNs(): string {
    let suffix = this.timeEpochNs.substring(this.timeEpochMs.toString().length);
    return this.timestamp + suffix;
  }

  getDisplayedFieldValue(fieldName: string, stripAnsi = false): string {
    if (fieldName === LOG_LINE_BODY_FIELD_NAME) {
      return stripAnsi ? ansicolor.strip(this.body) : this.body;
    }
    let fieldValue = '';
    if (this.labels[fieldName] != null) {
      fieldValue = this.labels[fieldName];
    } else {
      const field = this.fields.find((field) => {
        return field.keys[0] === fieldName;
      });

      fieldValue = field ? field.values.toString() : '';
    }
    if (!this._wrapLogMessage) {
      return fieldValue.replace(NEWLINES_REGEX, '');
    }
    return fieldValue;
  }

  updateCollapsedState(displayedFields: string[], container: HTMLDivElement | null) {
    const line =
      displayedFields.length > 0
        ? displayedFields.map((field) => this.getDisplayedFieldValue(field, true)).join('')
        : this.body;

    // Length truncation
    let collapsed =
      line.length >= (this._virtualization?.getTruncationLength(container) ?? TRUNCATION_DEFAULT_LENGTH)
        ? true
        : undefined;

    // Newlines truncation
    if (!collapsed && this._virtualization) {
      const truncationLimit = this._virtualization.getTruncationLineCount();
      collapsed = countNewLines(line, truncationLimit) >= truncationLimit ? true : collapsed;
    }

    if (this.collapsed === undefined || collapsed === undefined) {
      this.collapsed = collapsed;
      this._body = undefined;
      this._highlightedBody = undefined;
    }
  }

  setCollapsedState(collapsed: boolean) {
    if (this.collapsed !== collapsed) {
      this._body = undefined;
      this._highlightedBody = undefined;
    }
    this.collapsed = collapsed;
  }

  setCurrentSearch(search: string | undefined) {
    this._currentSearch = search;
    this._highlightedBody = undefined;
  }
}

export interface PreProcessOptions {
  escape: boolean;
  getFieldLinks?: GetFieldLinksFn;
  order: LogsSortOrder;
  timeZone: string;
  virtualization?: LogLineVirtualization;
  wrapLogMessage: boolean;
}

export const preProcessLogs = (
  logs: LogRowModel[],
  { escape, getFieldLinks, order, timeZone, virtualization, wrapLogMessage }: PreProcessOptions,
  grammar?: Grammar
): LogListModel[] => {
  const orderedLogs = sortLogRows(logs, order);
  return orderedLogs.map((log) =>
    preProcessLog(log, {
      escape,
      getFieldLinks,
      grammar,
      timeZone,
      virtualization,
      wrapLogMessage,
    })
  );
};

interface PreProcessLogOptions {
  escape: boolean;
  getFieldLinks?: GetFieldLinksFn;
  grammar?: Grammar;
  timeZone: string;
  virtualization?: LogLineVirtualization;
  wrapLogMessage: boolean;
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

function countNewLines(log: string, limit = Infinity) {
  let count = 0;
  for (let i = 0; i < log.length; ++i) {
    // No need to iterate further
    if (count > Infinity) {
      return count;
    }
    if (log[i] === '\n') {
      count += 1;
    } else if (log[i] === '\r') {
      count += 1;
      // skip LF in CRLF
      if (log[i] === '\n') {
        i += 1;
      }
    }
  }
  return count;
}
