import { countBy, chain, max } from 'lodash';

import {
  LogLevel,
  LogRowModel,
  LogLabelStatsModel,
  LogsModel,
  LogsSortOrder,
  DataFrame,
  FieldConfig,
  FieldCache,
  FieldType,
  MutableDataFrame,
  QueryResultMeta,
  LogsVolumeType,
} from '@grafana/data';

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
      const key = field.keys[0];
      acc[key] = field.values[0];
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

export const getLogsVolumeDimensions = (dataFrames: DataFrame[]) => {
  let maximumValue = -Infinity;
  let widestRange = { from: Infinity, to: -Infinity };

  dataFrames.forEach((dataFrame: DataFrame) => {
    const meta = dataFrame.meta?.custom || {};
    if (meta.absoluteRange?.from && meta.absoluteRange?.to) {
      widestRange = {
        from: Math.min(widestRange.from, meta.absoluteRange.from),
        to: Math.max(widestRange.to, meta.absoluteRange.to),
      };
    }
    const fieldCache = new FieldCache(dataFrame);
    const valueField = fieldCache.getFirstFieldOfType(FieldType.number);
    if (valueField) {
      maximumValue = Math.max(maximumValue, max(valueField.values.toArray()));
    }
  });

  return {
    maximumValue,
    widestRange,
  };
};

export const mergeLogsVolumeDataFrames = (dataFrames: DataFrame[]): DataFrame[] => {
  if (dataFrames.length === 0) {
    throw new Error('Cannot aggregate data frames: there must be at least one data frame to aggregate');
  }

  const aggregated: Record<string, Record<number, number>> = {};
  const configs: Record<
    string,
    { meta?: QueryResultMeta; valueFieldConfig: FieldConfig; timeFieldConfig: FieldConfig }
  > = {};
  let results: DataFrame[] = [];

  // collect and aggregate into aggregated object
  dataFrames.forEach((dataFrame) => {
    const fieldCache = new FieldCache(dataFrame);
    const timeField = fieldCache.getFirstFieldOfType(FieldType.time);
    const valueField = fieldCache.getFirstFieldOfType(FieldType.number);

    if (!timeField) {
      throw new Error('Missing time field');
    }
    if (!valueField) {
      throw new Error('Missing value field');
    }

    const level = valueField.config.displayNameFromDS || dataFrame.name || 'logs';
    const length = valueField.values.length;
    configs[level] = {
      meta: dataFrame.meta,
      valueFieldConfig: valueField.config,
      timeFieldConfig: timeField.config,
    };

    for (let pointIndex = 0; pointIndex < length; pointIndex++) {
      const time: number = timeField.values.get(pointIndex);
      const value: number = valueField.values.get(pointIndex);
      aggregated[level] ??= {};
      aggregated[level][time] = (aggregated[level][time] || 0) + value;
    }
  });

  // convert aggregated into data frames
  Object.keys(aggregated).forEach((level) => {
    const levelDataFrame = new MutableDataFrame();
    const { meta, timeFieldConfig, valueFieldConfig } = configs[level];
    // Log Volume visualization uses the name when toggling the legend
    levelDataFrame.name = level;
    levelDataFrame.meta = meta;
    levelDataFrame.addField({ name: 'Time', type: FieldType.time, config: timeFieldConfig });
    levelDataFrame.addField({ name: 'Value', type: FieldType.number, config: valueFieldConfig });

    for (const time in aggregated[level]) {
      const value = aggregated[level][time];
      levelDataFrame.add({
        Time: Number(time),
        Value: value,
      });
    }

    results.push(levelDataFrame);
  });

  return results;
};

export const getLogsVolumeDataSourceInfo = (dataFrames: DataFrame[]): { name: string } | null => {
  const customMeta = dataFrames[0]?.meta?.custom;

  if (customMeta && customMeta.datasourceName) {
    return {
      name: customMeta.datasourceName,
    };
  }

  return null;
};

export const isLogsVolumeLimited = (dataFrames: DataFrame[]) => {
  return dataFrames[0]?.meta?.custom?.logsVolumeType === LogsVolumeType.Limited;
};
