import { countBy, chain, escapeRegExp } from 'lodash';

import {
  ArrayVector,
  DataFrame,
  FieldType,
  LogLevel,
  LogRowModel,
  LogLabelStatsModel,
  LogsModel,
  LogsSortOrder,
} from '@grafana/data';
import { isNotNullish } from 'app/core/utils/types';

// This matches:
// first a label from start of the string or first white space, then any word chars until "="
// second either an empty quotes, or anything that starts with quote and ends with unescaped quote,
// or any non whitespace chars that do not start with quote
const LOGFMT_REGEXP = /(?:^|\s)([\w\(\)\[\]\{\}]+)=(""|(?:".*?[^\\]"|[^"\s]\S*))/;

/**
 * Returns the log level of a log line.
 * Parse the line for level words. If no level is found, it returns `LogLevel.unknown`.
 *
 * Example: `getLogLevel('WARN 1999-12-31 this is great') // LogLevel.warn`
 */
export function getLogLevel(line: string): LogLevel {
  if (!line) {
    return LogLevel.unknown;
  }
  let level = LogLevel.unknown;
  let currentIndex: number | undefined = undefined;

  for (const key of Object.keys(LogLevel)) {
    const regexp = new RegExp(`\\b${key}\\b`, 'i');
    const result = regexp.exec(line);

    if (result) {
      if (currentIndex === undefined || result.index < currentIndex) {
        level = (LogLevel as any)[key];
        currentIndex = result.index;
      }
    }
  }
  return level;
}

export function getLogLevelFromKey(key: string | number): LogLevel {
  const level = (LogLevel as any)[key.toString().toLowerCase()];
  if (level) {
    return level;
  }

  return LogLevel.unknown;
}

export function addLogLevelToSeries(series: DataFrame, lineIndex: number): DataFrame {
  const levels = new ArrayVector<LogLevel>();
  const lines = series.fields[lineIndex];
  for (let i = 0; i < lines.values.length; i++) {
    const line = lines.values.get(lineIndex);
    levels.buffer.push(getLogLevel(line));
  }

  return {
    ...series, // Keeps Tags, RefID etc
    fields: [
      ...series.fields,
      {
        name: 'LogLevel',
        type: FieldType.string,
        values: levels,
        config: {},
      },
    ],
  };
}

/* parses JSON into an object-ish thing, never throws an exception, returns `null` if data is invalid */
function safeJSONParse(logLine: string): Record<string, unknown> | null {
  let data: any = null;
  try {
    data = JSON.parse(logLine);
  } catch {
    return null;
  }

  // we check that the data is really an object
  // (we need to check for array too, because in javascript
  // typeof-array-is-object)
  return typeof data === 'object' && !Array.isArray(data) ? data : null;
}

interface LogsParser {
  /**
   * Value-agnostic matcher for a field label.
   * Used to filter rows.
   */
  buildMatcher: (label: string) => (logLine: string) => string | null;

  /**
   * Returns all parsable substrings from a line, used for highlighting
   */
  getFields: (line: string) => string[];

  /**
   * Gets the label name from a parsable substring of a line
   */
  getLabelFromField: (field: string) => string;

  /**
   * Gets the label value from a parsable substring of a line
   */
  getValueFromField: (field: string) => string;
  /**
   * Function to verify if this is a valid parser for the given line.
   * The parser accepts the line if it returns true.
   */
  test: (line: string) => boolean;
}

export const LogsParsers: { [name: string]: LogsParser } = {
  JSON: {
    buildMatcher: (label) => {
      const matcher = (logLine: string): string | null => {
        const obj = safeJSONParse(logLine);
        if (obj == null) {
          return null;
        }

        const result = obj[label];

        // if it is `null` or `undefined`, we return `null`
        return result == null ? null : result.toString();
      };
      return matcher;
    },
    getFields: (line) => {
      const parsed = safeJSONParse(line);
      if (parsed == null) {
        return [];
      }
      return Object.keys(parsed).map((key) => {
        return `"${key}":${JSON.stringify(parsed[key])}`;
      });
    },
    getLabelFromField: (field) => (field.match(/^"([^"]+)"\s*:/) || [])[1],
    getValueFromField: (field) => (field.match(/:\s*(.*)$/) || [])[1],
    test: (line) => {
      const parsed = safeJSONParse(line);
      return parsed != null;
    },
  },

  logfmt: {
    buildMatcher: (label) => {
      const matcher = (logLine: string): string | null => {
        const re = new RegExp(`(?:^|\\s)${escapeRegExp(label)}=("[^"]*"|\\S+)`);
        const match = logLine.match(re);
        return match ? match[1] : null;
      };
      return matcher;
    },
    getFields: (line) => {
      const fields: string[] = [];
      line.replace(new RegExp(LOGFMT_REGEXP, 'g'), (substring) => {
        fields.push(substring.trim());
        return '';
      });
      return fields;
    },
    getLabelFromField: (field) => (field.match(LOGFMT_REGEXP) || [])[1],
    getValueFromField: (field) => (field.match(LOGFMT_REGEXP) || [])[2],
    test: (line) => LOGFMT_REGEXP.test(line),
  },
};

export function calculateFieldStats(
  rows: LogRowModel[],
  extractor: (logLine: string) => string | null
): LogLabelStatsModel[] {
  const values = rows.map((row) => extractor(row.entry)).filter(isNotNullish);

  const rowCount = values.length;

  const countsByValue = countBy(values);

  return getSortedCounts(countsByValue, rowCount);
}

export function calculateLogsLabelStats(rows: LogRowModel[], label: string): LogLabelStatsModel[] {
  // Consider only rows that have the given label
  const rowsWithLabel = rows.filter((row) => row.labels[label] !== undefined);
  const rowCount = rowsWithLabel.length;

  // Get label value counts for eligible rows
  const countsByValue = countBy(rowsWithLabel, (row) => (row as LogRowModel).labels[label]);
  return getSortedCounts(countsByValue, rowCount);
}

export function calculateStats(values: unknown[]): LogLabelStatsModel[] {
  const nonEmptyValues = values.filter((value) => value !== undefined && value !== null);
  const countsByValue = countBy(nonEmptyValues);
  return getSortedCounts(countsByValue, nonEmptyValues.length);
}

const getSortedCounts = (countsByValue: { [value: string]: number }, rowCount: number) => {
  return chain(countsByValue)
    .map((count, value) => ({ count, value, proportion: count / rowCount }))
    .sortBy('count')
    .reverse()
    .value();
};

export function getParser(line: string): LogsParser | undefined {
  let parser;
  try {
    if (LogsParsers.JSON.test(line)) {
      parser = LogsParsers.JSON;
    }
  } catch (error) {}

  if (!parser && LogsParsers.logfmt.test(line)) {
    parser = LogsParsers.logfmt;
  }

  return parser;
}

export const sortInAscendingOrder = (a: LogRowModel, b: LogRowModel) => {
  // compare milliseconds
  if (a.timeEpochMs < b.timeEpochMs) {
    return -1;
  }

  if (a.timeEpochMs > b.timeEpochMs) {
    return 1;
  }

  // if milliseconds are equal, compare nanoseconds
  if (a.timeEpochNs < b.timeEpochNs) {
    return -1;
  }

  if (a.timeEpochNs > b.timeEpochNs) {
    return 1;
  }

  return 0;
};

export const sortInDescendingOrder = (a: LogRowModel, b: LogRowModel) => {
  // compare milliseconds
  if (a.timeEpochMs > b.timeEpochMs) {
    return -1;
  }

  if (a.timeEpochMs < b.timeEpochMs) {
    return 1;
  }

  // if milliseconds are equal, compare nanoseconds
  if (a.timeEpochNs > b.timeEpochNs) {
    return -1;
  }

  if (a.timeEpochNs < b.timeEpochNs) {
    return 1;
  }

  return 0;
};

export const sortLogsResult = (logsResult: LogsModel | null, sortOrder: LogsSortOrder): LogsModel => {
  const rows = logsResult ? sortLogRows(logsResult.rows, sortOrder) : [];
  return logsResult ? { ...logsResult, rows } : { hasUniqueLabels: false, rows };
};

export const sortLogRows = (logRows: LogRowModel[], sortOrder: LogsSortOrder) =>
  sortOrder === LogsSortOrder.Ascending ? logRows.sort(sortInAscendingOrder) : logRows.sort(sortInDescendingOrder);

// Currently supports only error condition in Loki logs
export const checkLogsError = (logRow: LogRowModel): { hasError: boolean; errorMessage?: string } => {
  if (logRow.labels.__error__) {
    return {
      hasError: true,
      errorMessage: logRow.labels.__error__,
    };
  }
  return {
    hasError: false,
  };
};

export const escapeUnescapedString = (string: string) =>
  string.replace(/\\r\\n|\\n|\\t|\\r/g, (match: string) => (match.slice(1) === 't' ? '\t' : '\n'));
