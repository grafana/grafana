import { countBy, chain } from 'lodash';

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
  NumericLogLevel,
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

  for (const [key, value] of Object.entries(LogLevel)) {
    const regexp = new RegExp(`\\b${key}\\b`, 'i');
    const result = regexp.exec(line);

    if (result) {
      if (currentIndex === undefined || result.index < currentIndex) {
        level = value;
        currentIndex = result.index;
      }
    }
  }
  return level;
}

export function getLogLevelFromKey(key: string | number): LogLevel {
  const level = LogLevel[key.toString().toLowerCase() as keyof typeof LogLevel];
  if (level) {
    return level;
  }
  if (typeof key === 'string') {
    // The level did not match any entry of LogLevel. It might be unknown or a numeric level.
    const numericLevel = parseInt(key, 10);
    // Safety check to confirm that we're parsing a number and not a number with a string.
    // For example `parseInt('1abcd', 10)` outputs 1
    if (key.length === numericLevel.toString().length) {
      return NumericLogLevel[key] || LogLevel.unknown;
    }
  } else if (typeof key === 'number') {
    return NumericLogLevel[key] || LogLevel.unknown;
  }

  return LogLevel.unknown;
}

export function calculateLogsLabelStats(rows: LogRowModel[], label: string): LogLabelStatsModel[] {
  // Consider only rows that have the given label
  const rowsWithLabel = rows.filter((row) => row.labels[label] !== undefined);
  const rowCount = rowsWithLabel.length;

  // Get label value counts for eligible rows
  const countsByValue = countBy(rowsWithLabel, (row) => row.labels[label]);
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
export const checkLogsError = (logRow: LogRowModel): string | undefined => {
  return logRow.labels.__error__;
};

export const checkLogsSampled = (logRow: LogRowModel): string | undefined => {
  if (!logRow.labels.__adaptive_logs_sampled__) {
    return undefined;
  }
  return logRow.labels.__adaptive_logs_sampled__ === 'true'
    ? 'Logs like this one have been dropped by Adaptive Logs'
    : `${logRow.labels.__adaptive_logs_sampled__}% of logs like this one have been dropped by Adaptive Logs`;
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

export const getLogsVolumeMaximumRange = (dataFrames: DataFrame[]) => {
  let widestRange = { from: Infinity, to: -Infinity };

  dataFrames.forEach((dataFrame: DataFrame) => {
    const meta = dataFrame.meta?.custom || {};
    if (meta.absoluteRange?.from && meta.absoluteRange?.to) {
      widestRange = {
        from: Math.min(widestRange.from, meta.absoluteRange.from),
        to: Math.max(widestRange.to, meta.absoluteRange.to),
      };
    }
  });

  return widestRange;
};

/**
 * Merge data frames by level and calculate maximum total value for all levels together
 */
export const mergeLogsVolumeDataFrames = (dataFrames: DataFrame[]): { dataFrames: DataFrame[]; maximum: number } => {
  if (dataFrames.length === 0) {
    throw new Error('Cannot aggregate data frames: there must be at least one data frame to aggregate');
  }

  // aggregate by level (to produce data frames)
  const aggregated: Record<string, Record<number, number>> = {};

  // aggregate totals to align Y axis when multiple log volumes are shown
  const totals: Record<number, number> = {};
  let maximumValue = -Infinity;

  const configs: Record<
    string,
    { meta?: QueryResultMeta; valueFieldConfig: FieldConfig; timeFieldConfig: FieldConfig }
  > = {};
  let results: DataFrame[] = [];

  // collect and aggregate into aggregated object
  dataFrames.forEach((dataFrame) => {
    const { level, valueField, timeField, length } = getLogLevelInfo(dataFrame);

    configs[level] = {
      meta: dataFrame.meta,
      valueFieldConfig: valueField.config,
      timeFieldConfig: timeField.config,
    };

    for (let pointIndex = 0; pointIndex < length; pointIndex++) {
      const time: number = timeField.values[pointIndex];
      const value: number = valueField.values[pointIndex];
      aggregated[level] ??= {};
      aggregated[level][time] = (aggregated[level][time] || 0) + value;

      totals[time] = (totals[time] || 0) + value;
      maximumValue = Math.max(totals[time], maximumValue);
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

    Object.entries(aggregated[level])
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .forEach(([time, value]) => {
        levelDataFrame.add({
          Time: Number(time),
          Value: value,
        });
      });

    results.push(levelDataFrame);
  });

  return { dataFrames: results, maximum: maximumValue };
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

export const copyText = async (text: string, buttonRef: React.MutableRefObject<Element | null>) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Use a fallback method for browsers/contexts that don't support the Clipboard API.
    // See https://web.dev/async-clipboard/#feature-detection.
    // Use textarea so the user can copy multi-line content.
    const textarea = document.createElement('textarea');
    // Normally we'd append this to the body. However if we're inside a focus manager
    // from react-aria, we can't focus anything outside of the managed area.
    // Instead, let's append it to the button. Then we're guaranteed to be able to focus + copy.
    buttonRef.current?.appendChild(textarea);
    textarea.value = text;
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
};

export function getLogLevelInfo(dataFrame: DataFrame) {
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
  return { level, valueField, timeField, length };
}

export function targetIsElement(target: EventTarget | null): target is Element {
  return target instanceof Element;
}

export function createLogRowsMap() {
  const logRowsSet = new Set();
  return function (target: LogRowModel): boolean {
    let id = `${target.dataFrame.refId}_${target.rowId ? target.rowId : `${target.timeEpochNs}_${target.entry}`}`;
    if (logRowsSet.has(id)) {
      return true;
    }
    logRowsSet.add(id);
    return false;
  };
}

function getLabelTypeFromFrame(labelKey: string, frame: DataFrame, index: number): null | string {
  const typeField = frame.fields.find((field) => field.name === 'labelTypes')?.values[index];
  if (!typeField) {
    return null;
  }
  return typeField[labelKey] ?? null;
}

export function getLabelTypeFromRow(label: string, row: LogRowModel) {
  if (!row.datasourceType) {
    return null;
  }
  const idField = row.dataFrame.fields.find((field) => field.name === 'id');
  if (!idField) {
    return null;
  }
  const rowIndex = idField.values.findIndex((id) => id === row.rowId);
  if (rowIndex < 0) {
    return null;
  }
  const labelType = getLabelTypeFromFrame(label, row.dataFrame, rowIndex);
  if (!labelType) {
    return null;
  }
  return getDataSourceLabelType(labelType, row.datasourceType);
}

function getDataSourceLabelType(labelType: string, datasourceType: string) {
  switch (datasourceType) {
    case 'loki':
      switch (labelType) {
        case 'I':
          return 'Indexed label';
        case 'S':
          return 'Structured metadata';
        case 'P':
          return 'Parsed label';
        default:
          return null;
      }
    default:
      return null;
  }
}

const POPOVER_STORAGE_KEY = 'logs.popover.disabled';
export function disablePopoverMenu() {
  localStorage.setItem(POPOVER_STORAGE_KEY, 'true');
}

export function enablePopoverMenu() {
  localStorage.removeItem(POPOVER_STORAGE_KEY);
}

export function isPopoverMenuDisabled() {
  return Boolean(localStorage.getItem(POPOVER_STORAGE_KEY));
}
