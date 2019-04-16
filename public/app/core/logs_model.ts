import _ from 'lodash';

import { colors, TimeSeries } from '@grafana/ui';
import { getThemeColor } from 'app/core/utils/colors';

/**
 * Mapping of log level abbreviation to canonical log level.
 * Supported levels are reduce to limit color variation.
 */
export enum LogLevel {
  emerg = 'critical',
  alert = 'critical',
  crit = 'critical',
  critical = 'critical',
  warn = 'warning',
  warning = 'warning',
  err = 'error',
  eror = 'error',
  error = 'error',
  info = 'info',
  notice = 'info',
  dbug = 'debug',
  debug = 'debug',
  trace = 'trace',
  unknown = 'unknown',
}

export const LogLevelColor = {
  [LogLevel.critical]: colors[7],
  [LogLevel.warning]: colors[1],
  [LogLevel.error]: colors[4],
  [LogLevel.info]: colors[0],
  [LogLevel.debug]: colors[5],
  [LogLevel.trace]: colors[2],
  [LogLevel.unknown]: getThemeColor('#8e8e8e', '#dde4ed'),
};

export interface LogSearchMatch {
  start: number;
  length: number;
  text: string;
}

export interface LogRowModel {
  duplicates?: number;
  entry: string;
  hasAnsi: boolean;
  key: string; // timestamp + labels
  labels: LogsStreamLabels;
  logLevel: LogLevel;
  raw: string;
  searchWords?: string[];
  timestamp: string; // ISO with nanosec precision
  timeFromNow: string;
  timeEpochMs: number;
  timeLocal: string;
  uniqueLabels?: LogsStreamLabels;
}

export interface LogLabelStatsModel {
  active?: boolean;
  count: number;
  proportion: number;
  value: string;
}

export enum LogsMetaKind {
  Number,
  String,
  LabelsMap,
}

export interface LogsMetaItem {
  label: string;
  value: string | number | LogsStreamLabels;
  kind: LogsMetaKind;
}

export interface LogsModel {
  hasUniqueLabels: boolean;
  id: string; // Identify one logs result from another
  meta?: LogsMetaItem[];
  rows: LogRowModel[];
  series?: TimeSeries[];
}

export interface LogsStream {
  labels: string;
  entries: LogsStreamEntry[];
  search?: string;
  parsedLabels?: LogsStreamLabels;
  uniqueLabels?: LogsStreamLabels;
}

export interface LogsStreamEntry {
  line: string;
  ts: string;
  // Legacy, was renamed to ts
  timestamp?: string;
}

export interface LogsStreamLabels {
  [key: string]: string;
}

export enum LogsDedupDescription {
  none = 'No de-duplication',
  exact = 'De-duplication of successive lines that are identical, ignoring ISO datetimes.',
  numbers = 'De-duplication of successive lines that are identical when ignoring numbers, e.g., IP addresses, latencies.',
  signature = 'De-duplication of successive lines that have identical punctuation and whitespace.',
}

export enum LogsDedupStrategy {
  none = 'none',
  exact = 'exact',
  numbers = 'numbers',
  signature = 'signature',
}

export interface LogsParser {
  /**
   * Value-agnostic matcher for a field label.
   * Used to filter rows, and first capture group contains the value.
   */
  buildMatcher: (label: string) => RegExp;

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
   * The parser accepts the line unless it returns undefined.
   */
  test: (line: string) => any;
}

const LOGFMT_REGEXP = /(?:^|\s)(\w+)=("[^"]*"|\S+)/;

export const LogsParsers: { [name: string]: LogsParser } = {
  JSON: {
    buildMatcher: label => new RegExp(`(?:{|,)\\s*"${label}"\\s*:\\s*"?([\\d\\.]+|[^"]*)"?`),
    getFields: line => {
      const fields = [];
      try {
        const parsed = JSON.parse(line);
        _.map(parsed, (value, key) => {
          const fieldMatcher = new RegExp(`"${key}"\\s*:\\s*"?${_.escapeRegExp(JSON.stringify(value))}"?`);

          const match = line.match(fieldMatcher);
          if (match) {
            fields.push(match[0]);
          }
        });
      } catch {}
      return fields;
    },
    getLabelFromField: field => (field.match(/^"(\w+)"\s*:/) || [])[1],
    getValueFromField: field => (field.match(/:\s*(.*)$/) || [])[1],
    test: line => {
      try {
        return JSON.parse(line);
      } catch (error) {}
    },
  },

  logfmt: {
    buildMatcher: label => new RegExp(`(?:^|\\s)${label}=("[^"]*"|\\S+)`),
    getFields: line => {
      const fields = [];
      line.replace(new RegExp(LOGFMT_REGEXP, 'g'), substring => {
        fields.push(substring.trim());
        return '';
      });
      return fields;
    },
    getLabelFromField: field => (field.match(LOGFMT_REGEXP) || [])[1],
    getValueFromField: field => (field.match(LOGFMT_REGEXP) || [])[2],
    test: line => LOGFMT_REGEXP.test(line),
  },
};

export function calculateFieldStats(rows: LogRowModel[], extractor: RegExp): LogLabelStatsModel[] {
  // Consider only rows that satisfy the matcher
  const rowsWithField = rows.filter(row => extractor.test(row.entry));
  const rowCount = rowsWithField.length;

  // Get field value counts for eligible rows
  const countsByValue = _.countBy(rowsWithField, row => (row as LogRowModel).entry.match(extractor)[1]);
  const sortedCounts = _.chain(countsByValue)
    .map((count, value) => ({ count, value, proportion: count / rowCount }))
    .sortBy('count')
    .reverse()
    .value();

  return sortedCounts;
}

export function calculateLogsLabelStats(rows: LogRowModel[], label: string): LogLabelStatsModel[] {
  // Consider only rows that have the given label
  const rowsWithLabel = rows.filter(row => row.labels[label] !== undefined);
  const rowCount = rowsWithLabel.length;

  // Get label value counts for eligible rows
  const countsByValue = _.countBy(rowsWithLabel, row => (row as LogRowModel).labels[label]);
  const sortedCounts = _.chain(countsByValue)
    .map((count, value) => ({ count, value, proportion: count / rowCount }))
    .sortBy('count')
    .reverse()
    .value();

  return sortedCounts;
}

const isoDateRegexp = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-6]\d[,\.]\d+([+-][0-2]\d:[0-5]\d|Z)/g;
function isDuplicateRow(row: LogRowModel, other: LogRowModel, strategy: LogsDedupStrategy): boolean {
  switch (strategy) {
    case LogsDedupStrategy.exact:
      // Exact still strips dates
      return row.entry.replace(isoDateRegexp, '') === other.entry.replace(isoDateRegexp, '');

    case LogsDedupStrategy.numbers:
      return row.entry.replace(/\d/g, '') === other.entry.replace(/\d/g, '');

    case LogsDedupStrategy.signature:
      return row.entry.replace(/\w/g, '') === other.entry.replace(/\w/g, '');

    default:
      return false;
  }
}

export function dedupLogRows(logs: LogsModel, strategy: LogsDedupStrategy): LogsModel {
  if (strategy === LogsDedupStrategy.none) {
    return logs;
  }

  const dedupedRows = logs.rows.reduce((result: LogRowModel[], row: LogRowModel, index, list) => {
    const rowCopy = { ...row };
    const previous = result[result.length - 1];
    if (index > 0 && isDuplicateRow(row, previous, strategy)) {
      previous.duplicates++;
    } else {
      rowCopy.duplicates = 0;
      result.push(rowCopy);
    }
    return result;
  }, []);

  return {
    ...logs,
    rows: dedupedRows,
  };
}

export function getParser(line: string): LogsParser {
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

export function filterLogLevels(logs: LogsModel, hiddenLogLevels: Set<LogLevel>): LogsModel {
  if (hiddenLogLevels.size === 0) {
    return logs;
  }

  const filteredRows = logs.rows.reduce((result: LogRowModel[], row: LogRowModel, index, list) => {
    if (!hiddenLogLevels.has(row.logLevel)) {
      result.push(row);
    }
    return result;
  }, []);

  return {
    ...logs,
    rows: filteredRows,
  };
}

export function makeSeriesForLogs(rows: LogRowModel[], intervalMs: number): TimeSeries[] {
  // currently interval is rangeMs / resolution, which is too low for showing series as bars.
  // need at least 10px per bucket, so we multiply interval by 10. Should be solved higher up the chain
  // when executing queries & interval calculated and not here but this is a temporary fix.
  // intervalMs = intervalMs * 10;

  // Graph time series by log level
  const seriesByLevel = {};
  const bucketSize = intervalMs * 10;
  const seriesList = [];

  for (const row of rows) {
    let series = seriesByLevel[row.logLevel];

    if (!series) {
      seriesByLevel[row.logLevel] = series = {
        lastTs: null,
        datapoints: [],
        alias: row.logLevel,
        color: LogLevelColor[row.logLevel],
      };

      seriesList.push(series);
    }

    // align time to bucket size
    const time = Math.round(row.timeEpochMs / bucketSize) * bucketSize;

    // Entry for time
    if (time === series.lastTs) {
      series.datapoints[series.datapoints.length - 1][0]++;
    } else {
      series.datapoints.push([1, time]);
      series.lastTs = time;
    }

    // add zero to other levels to aid stacking so each level series has same number of points
    for (const other of seriesList) {
      if (other !== series && other.lastTs !== time) {
        other.datapoints.push([0, time]);
        other.lastTs = time;
      }
    }
  }

  return seriesList.map(series => {
    series.datapoints.sort((a, b) => {
      return a[1] - b[1];
    });

    return {
      datapoints: series.datapoints,
      target: series.alias,
      alias: series.alias,
      color: series.color,
    };
  });
}
