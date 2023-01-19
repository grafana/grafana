import { countBy, chain } from 'lodash';

import { LogLevel, LogRowModel, LogLabelStatsModel, LogsModel, LogsSortOrder } from '@grafana/data';

import { getDataframeFields } from './components/logParser';

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

export function logRowsToReadableJson(logs: LogRowModel[]) {
  return logs.map((log) => {
    const fields = getDataframeFields(log).reduce<Record<string, string>>((acc, field) => {
      acc[field.key] = field.value;
      return acc;
    }, {});

    return {
      line: log.entry,
      timestamp: log.timeEpochNs,
      fields: {
        ...fields,
        ...log.labels,
      },
    };
  });
}
