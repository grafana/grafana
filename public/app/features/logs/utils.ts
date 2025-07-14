import saveAs from 'file-saver';
import { countBy, chain } from 'lodash';
import { MouseEvent } from 'react';
import { lastValueFrom, map, Observable } from 'rxjs';

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
  getFieldDisplayName,
  getDefaultTimeRange,
  locationUtil,
  urlUtil,
  dateTime,
  dateTimeFormat,
  DataTransformerConfig,
  CustomTransformOperator,
  transformDataFrame,
  getTimeField,
  Field,
  LogsMetaItem,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getConfig } from 'app/core/config';

import { getLogsExtractFields } from '../explore/Logs/LogsTable';
import { downloadDataFrameAsCsv, downloadLogsModelAsTxt } from '../inspector/utils/download';

import { getDataframeFields } from './components/logParser';
import { GetRowContextQueryFn } from './components/panel/LogLineMenu';

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
      date: dateTime(log.timeEpochMs).toISOString(),
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
    const { level, valueField, timeField } = getLogLevelInfo(dataFrame, dataFrames);

    if (!timeField || !valueField) {
      return;
    }

    configs[level] = {
      meta: dataFrame.meta,
      valueFieldConfig: valueField?.config ?? {},
      timeFieldConfig: timeField?.config ?? {},
    };

    for (let pointIndex = 0; pointIndex < dataFrame.length; pointIndex++) {
      const time: number = timeField.values[pointIndex];
      const value: number = valueField.values[pointIndex];
      aggregated[level] ??= {};
      aggregated[level][time] = (aggregated[level][time] || 0) + value;

      totals[time] = (totals[time] || 0) + value;
      if (totals[time] > maximumValue) {
        maximumValue = totals[time];
      }
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

export async function handleOpenLogsContextClick(
  event: MouseEvent<HTMLElement>,
  row: LogRowModel,
  getRowContextQuery: GetRowContextQueryFn | undefined,
  onOpenContext: (row: LogRowModel) => void
) {
  // if ctrl or meta key is pressed, open query in new Explore tab
  if (getRowContextQuery && (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey || event.nativeEvent.shiftKey)) {
    const win = window.open('about:blank');
    // for this request we don't want to use the cached filters from a context provider, but always want to refetch and clear
    const query = await getRowContextQuery(row, undefined, false);
    if (query && win) {
      const url = urlUtil.renderUrl(locationUtil.assureBaseUrl(`${getConfig().appSubUrl}explore`), {
        left: JSON.stringify({
          datasource: query.datasource,
          queries: [query],
          range: getDefaultTimeRange(),
        }),
      });
      win.location = url;

      return;
    }
    win?.close();
  }
  onOpenContext(row);
}

export function getLogLevelInfo(dataFrame: DataFrame, allDataFrames: DataFrame[]) {
  const fieldCache = new FieldCache(dataFrame);
  const timeField = fieldCache.getFirstFieldOfType(FieldType.time);
  const valueField = fieldCache.getFirstFieldOfType(FieldType.number);

  if (!timeField) {
    console.error('Time field missing in data frame');
  }
  if (!valueField) {
    console.error('Value field missing in data frame');
  }

  const level = valueField ? getFieldDisplayName(valueField, dataFrame, allDataFrames) : 'logs';
  return { level, valueField, timeField };
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

export function getLabelTypeFromRow(label: string, row: LogRowModel, plural = false) {
  if (!row.datasourceType) {
    return null;
  }
  const labelType = getLabelTypeFromFrame(label, row.dataFrame, row.rowIndex);
  if (!labelType) {
    return null;
  }
  return getDataSourceLabelType(labelType, row.datasourceType, plural);
}

function getDataSourceLabelType(labelType: string, datasourceType: string, plural: boolean) {
  switch (datasourceType) {
    case 'loki':
      switch (labelType) {
        case 'I':
          return t('logs.fields.type.loki.indexed-label', 'Indexed label', { count: plural ? 2 : 1 });
        case 'S':
          return t('logs.fields.type.loki.structured-metadata', 'Structured metadata', { count: plural ? 2 : 1 });
        case 'P':
          return t('logs.fields.type.loki.parsedl-label', 'Parsed field', { count: plural ? 2 : 1 });
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

export enum DownloadFormat {
  Text = 'text',
  Json = 'json',
  CSV = 'csv',
}

export const downloadLogs = async (format: DownloadFormat, logRows: LogRowModel[], meta?: LogsMetaItem[]) => {
  switch (format) {
    case DownloadFormat.Text:
      downloadLogsModelAsTxt({ meta, rows: logRows });
      break;
    case DownloadFormat.Json:
      const jsonLogs = logRowsToReadableJson(logRows);
      const blob = new Blob([JSON.stringify(jsonLogs)], {
        type: 'application/json;charset=utf-8',
      });
      const fileName = `Logs-${dateTimeFormat(new Date())}.json`;
      saveAs(blob, fileName);
      break;
    case DownloadFormat.CSV:
      const dataFrameMap = new Map<string, DataFrame>();
      logRows.forEach((row) => {
        if (row.dataFrame?.refId && !dataFrameMap.has(row.dataFrame?.refId)) {
          dataFrameMap.set(row.dataFrame?.refId, row.dataFrame);
        }
      });
      dataFrameMap.forEach(async (dataFrame) => {
        const transforms: Array<DataTransformerConfig | CustomTransformOperator> = getLogsExtractFields(dataFrame);
        transforms.push(
          {
            id: 'organize',
            options: {
              excludeByName: {
                ['labels']: true,
                ['labelTypes']: true,
              },
            },
          },
          addISODateTransformation
        );
        const transformedDataFrame = await lastValueFrom(transformDataFrame(transforms, [dataFrame]));
        downloadDataFrameAsCsv(transformedDataFrame[0], `Logs-${dataFrame.refId}`);
      });
  }
};

const addISODateTransformation: CustomTransformOperator = () => (source: Observable<DataFrame[]>) => {
  return source.pipe(
    map((data: DataFrame[]) => {
      return data.map((frame: DataFrame) => {
        const timeField = getTimeField(frame);
        const field: Field = {
          name: 'Date',
          values: timeField.timeField ? timeField.timeField?.values.map((v) => dateTime(v).toISOString()) : [],
          type: FieldType.other,
          config: {},
        };
        return {
          ...frame,
          fields: [field, ...frame.fields],
        };
      });
    })
  );
};
