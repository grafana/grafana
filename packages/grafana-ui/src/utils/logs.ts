import { LogLevel } from '../types/logs';
import { SeriesData, FieldType } from '../types/data';

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

export function addLogLevelToSeries(series: SeriesData, lineIndex: number): SeriesData {
  return {
    ...series, // Keeps Tags, RefID etc
    fields: [...series.fields, { name: 'LogLevel', type: FieldType.string }],
    rows: series.rows.map(row => {
      const line = row[lineIndex];
      return [...row, getLogLevel(line)];
    }),
  };
}
