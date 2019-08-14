import { countBy, chain } from 'lodash';

import { LogLevel, LogRowModel, LogLabelStatsModel } from '../types/logs';
import { DataFrame, FieldType } from '../types/data';

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
  for (const key of Object.keys(LogLevel)) {
    const regexp = new RegExp(`\\b${key}\\b`, 'i');
    if (regexp.test(line)) {
      const level = (LogLevel as any)[key];
      if (level) {
        return level;
      }
    }
  }
  return LogLevel.unknown;
}

export function getLogLevelFromKey(key: string): LogLevel {
  const level = (LogLevel as any)[key];
  if (level) {
    return level;
  }

  return LogLevel.unknown;
}

export function addLogLevelToSeries(series: DataFrame, lineIndex: number): DataFrame {
  return {
    ...series, // Keeps Tags, RefID etc
    fields: [...series.fields, { name: 'LogLevel', type: FieldType.string }],
    rows: series.rows.map(row => {
      const line = row[lineIndex];
      return [...row, getLogLevel(line)];
    }),
  };
}

export function calculateLogsLabelStats(rows: LogRowModel[], label: string): LogLabelStatsModel[] {
  // Consider only rows that have the given label
  const rowsWithLabel = rows.filter(row => row.labels[label] !== undefined);
  const rowCount = rowsWithLabel.length;

  // Get label value counts for eligible rows
  const countsByValue = countBy(rowsWithLabel, row => (row as LogRowModel).labels[label]);
  const sortedCounts = chain(countsByValue)
    .map((count, value) => ({ count, value, proportion: count / rowCount }))
    .sortBy('count')
    .reverse()
    .value();

  return sortedCounts;
}
