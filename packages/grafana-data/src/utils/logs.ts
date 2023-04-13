import { countBy, chain, escapeRegExp } from 'lodash';

import { DataFrame, FieldType } from '../types/index';
import { LogLevel, LogRowModel, LogLabelStatsModel, LogsParser, LogsModel, LogsSortOrder } from '../types/logs';

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
/** @deprecated will be removed in the next major version */
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
        level = LogLevel[key as keyof typeof LogLevel];
        currentIndex = result.index;
      }
    }
  }
  return level;
}

/** @deprecated will be removed in the next major version */
export function getLogLevelFromKey(key: string | number): LogLevel {
  const level = LogLevel[key.toString().toLowerCase() as keyof typeof LogLevel];
  if (level) {
    return level;
  }

  return LogLevel.unknown;
}

/** @deprecated will be removed in the next major version */
export function addLogLevelToSeries(series: DataFrame, lineIndex: number): DataFrame {
  const levels: LogLevel[] = [];
  const lines = series.fields[lineIndex];
  for (let i = 0; i < lines.values.length; i++) {
    const line = lines.values.get(lineIndex);
    levels.push(getLogLevel(line));
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

/** @deprecated will be removed in the next major version */
export const LogsParsers: { [name: string]: LogsParser } = {
  JSON: {
    buildMatcher: (label) => new RegExp(`(?:{|,)\\s*"${label}"\\s*:\\s*"?([\\d\\.]+|[^"]*)"?`),
    getFields: (line) => {
      try {
        const parsed = JSON.parse(line);
        return Object.keys(parsed).map((key) => {
          return `"${key}":${JSON.stringify(parsed[key])}`;
        });
      } catch {}
      return [];
    },
    getLabelFromField: (field) => (field.match(/^"([^"]+)"\s*:/) || [])[1],
    getValueFromField: (field) => (field.match(/:\s*(.*)$/) || [])[1],
    test: (line) => {
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch (error) {}
      // The JSON parser should only be used for log lines that are valid serialized JSON objects.
      // If it would be used for a string, detected fields would include each letter as a separate field.
      return typeof parsed === 'object';
    },
  },

  logfmt: {
    buildMatcher: (label) => new RegExp(`(?:^|\\s)${escapeRegExp(label)}=("[^"]*"|\\S+)`),
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

/** @deprecated will be removed in the next major version */
export function calculateFieldStats(rows: LogRowModel[], extractor: RegExp): LogLabelStatsModel[] {
  // Consider only rows that satisfy the matcher
  const rowsWithField = rows.filter((row) => extractor.test(row.entry));
  const rowCount = rowsWithField.length;

  // Get field value counts for eligible rows
  const countsByValue = countBy(rowsWithField, (r) => {
    const row: LogRowModel = r;
    const match = row.entry.match(extractor);

    return match ? match[1] : null;
  });
  return getSortedCounts(countsByValue, rowCount);
}

/** @deprecated will be removed in the next major version */
export function calculateLogsLabelStats(rows: LogRowModel[], label: string): LogLabelStatsModel[] {
  // Consider only rows that have the given label
  const rowsWithLabel = rows.filter((row) => row.labels[label] !== undefined);
  const rowCount = rowsWithLabel.length;

  // Get label value counts for eligible rows
  const countsByValue = countBy(rowsWithLabel, (row) => row.labels[label]);
  return getSortedCounts(countsByValue, rowCount);
}

/** @deprecated will be removed in the next major version */
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

/** @deprecated will be removed in the next major version */
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

/** @deprecated will be removed in the next major version */
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

/** @deprecated will be removed in the next major version */
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

/** @deprecated will be removed in the next major version */
export const sortLogsResult = (logsResult: LogsModel | null, sortOrder: LogsSortOrder): LogsModel => {
  const rows = logsResult ? sortLogRows(logsResult.rows, sortOrder) : [];
  return logsResult ? { ...logsResult, rows } : { hasUniqueLabels: false, rows };
};

/** @deprecated will be removed in the next major version */
export const sortLogRows = (logRows: LogRowModel[], sortOrder: LogsSortOrder) =>
  sortOrder === LogsSortOrder.Ascending ? logRows.sort(sortInAscendingOrder) : logRows.sort(sortInDescendingOrder);

// Currently supports only error condition in Loki logs
/** @deprecated will be removed in the next major version */
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

/** @deprecated will be removed in the next major version */
export const escapeUnescapedString = (string: string) =>
  string.replace(/\\r\\n|\\n|\\t|\\r/g, (match: string) => (match.slice(1) === 't' ? '\t' : '\n'));
