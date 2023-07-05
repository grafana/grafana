import { groupBy, size } from 'lodash';
import { from, isObservable, Observable } from 'rxjs';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  dateTimeFormat,
  dateTimeFormatTimeAgo,
  DateTimeInput,
  Field,
  FieldCache,
  FieldColorModeId,
  FieldType,
  findCommonLabels,
  findUniqueLabels,
  getTimeField,
  Labels,
  LoadingState,
  LogLevel,
  LogRowModel,
  LogsDedupStrategy,
  LogsMetaItem,
  LogsMetaKind,
  LogsModel,
  LogsVolumeCustomMetaData,
  LogsVolumeType,
  rangeUtil,
  ScopedVars,
  sortDataFrame,
  textUtil,
  TimeRange,
  toDataFrame,
  toUtc,
} from '@grafana/data';
import { SIPrefix } from '@grafana/data/src/valueFormats/symbolFormatters';
import { BarAlignment, GraphDrawStyle, StackingMode } from '@grafana/schema';
import { ansicolor, colors } from '@grafana/ui';
import { getThemeColor } from 'app/core/utils/colors';

import { LogsFrame, parseLogsFrame } from './logsFrame';
import { getLogLevel, getLogLevelFromKey, sortInAscendingOrder } from './utils';

export const LIMIT_LABEL = 'Line limit';
export const COMMON_LABELS = 'Common labels';

export const LogLevelColor = {
  [LogLevel.critical]: colors[7],
  [LogLevel.warning]: colors[1],
  [LogLevel.error]: colors[4],
  [LogLevel.info]: colors[0],
  [LogLevel.debug]: colors[5],
  [LogLevel.trace]: colors[2],
  [LogLevel.unknown]: getThemeColor('#8e8e8e', '#bdc4cd'),
};

const MILLISECOND = 1;
const SECOND = 1000 * MILLISECOND;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const isoDateRegexp = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-6]\d[,\.]\d+([+-][0-2]\d:[0-5]\d|Z)/g;
function isDuplicateRow(row: LogRowModel, other: LogRowModel, strategy?: LogsDedupStrategy): boolean {
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

export function dedupLogRows(rows: LogRowModel[], strategy?: LogsDedupStrategy): LogRowModel[] {
  if (strategy === LogsDedupStrategy.none) {
    return rows;
  }

  return rows.reduce((result: LogRowModel[], row: LogRowModel, index) => {
    const rowCopy = { ...row };
    const previous = result[result.length - 1];
    if (index > 0 && isDuplicateRow(row, previous, strategy)) {
      previous.duplicates!++;
    } else {
      rowCopy.duplicates = 0;
      result.push(rowCopy);
    }
    return result;
  }, []);
}

export function filterLogLevels(logRows: LogRowModel[], hiddenLogLevels: Set<LogLevel>): LogRowModel[] {
  if (hiddenLogLevels.size === 0) {
    return logRows;
  }

  return logRows.filter((row: LogRowModel) => {
    return !hiddenLogLevels.has(row.logLevel);
  });
}

interface Series {
  lastTs: number | null;
  datapoints: Array<[number, number]>;
  target: LogLevel;
  color: string;
}

export function makeDataFramesForLogs(sortedRows: LogRowModel[], bucketSize: number): DataFrame[] {
  // currently interval is rangeMs / resolution, which is too low for showing series as bars.
  // Should be solved higher up the chain when executing queries & interval calculated and not here but this is a temporary fix.

  // Graph time series by log level
  const seriesByLevel: Record<string, Series> = {};
  const seriesList: Series[] = [];

  for (const row of sortedRows) {
    let series = seriesByLevel[row.logLevel];

    if (!series) {
      seriesByLevel[row.logLevel] = series = {
        lastTs: null,
        datapoints: [],
        target: row.logLevel,
        color: LogLevelColor[row.logLevel],
      };

      seriesList.push(series);
    }

    // align time to bucket size - used Math.floor for calculation as time of the bucket
    // must be in the past (before Date.now()) to be displayed on the graph
    const time = Math.floor(row.timeEpochMs / bucketSize) * bucketSize;

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

  return seriesList.map((series, i) => {
    series.datapoints.sort((a: number[], b: number[]) => a[1] - b[1]);

    const data = toDataFrame(series);
    const fieldCache = new FieldCache(data);

    const valueField = fieldCache.getFirstFieldOfType(FieldType.number)!;

    data.fields[valueField.index].config.min = 0;
    data.fields[valueField.index].config.decimals = 0;
    data.fields[valueField.index].config.color = {
      mode: FieldColorModeId.Fixed,
      fixedColor: series.color,
    };

    data.fields[valueField.index].config.custom = {
      drawStyle: GraphDrawStyle.Bars,
      barAlignment: BarAlignment.Center,
      barWidthFactor: 0.9,
      barMaxWidth: 5,
      lineColor: series.color,
      pointColor: series.color,
      fillColor: series.color,
      lineWidth: 0,
      fillOpacity: 100,
      stacking: {
        mode: StackingMode.Normal,
        group: 'A',
      },
    };

    return data;
  });
}

function isLogsData(series: DataFrame) {
  return series.fields.some((f) => f.type === FieldType.time) && series.fields.some((f) => f.type === FieldType.string);
}

/**
 * Convert dataFrame into LogsModel which consists of creating separate array of log rows and metrics series. Metrics
 * series can be either already included in the dataFrame or will be computed from the log rows.
 * @param dataFrame
 * @param intervalMs Optional. In case there are no metrics series, we use this for computing it from log rows.
 * @param absoluteRange Optional. Used to store absolute range of executed queries in logs model. This is used for pagination.
 * @param queries Optional. Used to store executed queries in logs model. This is used for pagination.
 */
export function dataFrameToLogsModel(
  dataFrame: DataFrame[],
  intervalMs?: number,
  absoluteRange?: AbsoluteTimeRange,
  queries?: DataQuery[]
): LogsModel {
  const { logSeries } = separateLogsAndMetrics(dataFrame);
  const logsModel = logSeriesToLogsModel(logSeries, queries);

  if (logsModel) {
    // Create histogram metrics from logs using the interval as bucket size for the line count
    if (intervalMs && logsModel.rows.length > 0) {
      const sortedRows = logsModel.rows.sort(sortInAscendingOrder);
      const { visibleRange, bucketSize, visibleRangeMs, requestedRangeMs } = getSeriesProperties(
        sortedRows,
        intervalMs,
        absoluteRange
      );
      logsModel.visibleRange = visibleRange;
      logsModel.bucketSize = bucketSize;
      logsModel.series = makeDataFramesForLogs(sortedRows, bucketSize);

      if (logsModel.meta) {
        logsModel.meta = adjustMetaInfo(logsModel, visibleRangeMs, requestedRangeMs);
      }
    } else {
      logsModel.series = [];
    }
    logsModel.queries = queries;
    return logsModel;
  }

  return {
    hasUniqueLabels: false,
    rows: [],
    meta: [],
    series: [],
    queries,
  };
}

/**
 * Returns a clamped time range and interval based on the visible logs and the given range.
 *
 * @param sortedRows Log rows from the query response
 * @param intervalMs Dynamic data interval based on available pixel width
 * @param absoluteRange Requested time range
 * @param pxPerBar Default: 20, buckets will be rendered as bars, assuming 10px per histogram bar plus some free space around it
 */
export function getSeriesProperties(
  sortedRows: LogRowModel[],
  intervalMs: number,
  absoluteRange?: AbsoluteTimeRange,
  pxPerBar = 20,
  minimumBucketSize = 1000
) {
  let visibleRange = absoluteRange;
  let resolutionIntervalMs = intervalMs;
  let bucketSize = Math.max(resolutionIntervalMs * pxPerBar, minimumBucketSize);
  let visibleRangeMs;
  let requestedRangeMs;
  // Clamp time range to visible logs otherwise big parts of the graph might look empty
  if (absoluteRange) {
    const earliestTsLogs = sortedRows[0].timeEpochMs;

    requestedRangeMs = absoluteRange.to - absoluteRange.from;
    visibleRangeMs = absoluteRange.to - earliestTsLogs;

    if (visibleRangeMs > 0) {
      // Adjust interval bucket size for potentially shorter visible range
      const clampingFactor = visibleRangeMs / requestedRangeMs;
      resolutionIntervalMs *= clampingFactor;
      // Minimum bucketsize of 1s for nicer graphing
      bucketSize = Math.max(Math.ceil(resolutionIntervalMs * pxPerBar), minimumBucketSize);
      // makeSeriesForLogs() aligns dataspoints with time buckets, so we do the same here to not cut off data
      const adjustedEarliest = Math.floor(earliestTsLogs / bucketSize) * bucketSize;
      visibleRange = { from: adjustedEarliest, to: absoluteRange.to };
    } else {
      // We use visibleRangeMs to calculate range coverage of received logs. However, some data sources are rounding up range in requests. This means that received logs
      // can (in edge cases) be outside of the requested range and visibleRangeMs < 0. In that case, we want to change visibleRangeMs to be 1 so we can calculate coverage.
      visibleRangeMs = 1;
    }
  }
  return { bucketSize, visibleRange, visibleRangeMs, requestedRangeMs };
}

function separateLogsAndMetrics(dataFrames: DataFrame[]) {
  const metricSeries: DataFrame[] = [];
  const logSeries: DataFrame[] = [];

  for (const dataFrame of dataFrames) {
    // We want to show meta stats even if no result was returned. That's why we are pushing also data frames with no fields.
    if (isLogsData(dataFrame) || !dataFrame.fields.length) {
      logSeries.push(dataFrame);
      continue;
    }

    if (dataFrame.length > 0) {
      metricSeries.push(dataFrame);
    }
  }

  return { logSeries, metricSeries };
}

interface LogInfo {
  rawFrame: DataFrame;
  logsFrame: LogsFrame;
  frameLabels?: Labels[];
}

function parseTime(
  timeField: Field,
  timeNsField: Field | undefined,
  index: number
): { ts: DateTimeInput; timeEpochMs: number; timeEpochNs: string } {
  const ts = timeField.values[index];
  const time = toUtc(ts);
  const timeEpochMs = time.valueOf();

  if (timeNsField) {
    return { ts, timeEpochMs, timeEpochNs: timeNsField.values[index] };
  }

  if (timeField.nanos !== undefined) {
    const ns = timeField.nanos[index].toString().padStart(6, '0');
    const timeEpochNs = `${timeEpochMs}${ns}`;
    return { ts, timeEpochMs, timeEpochNs };
  }

  return {
    ts,
    timeEpochMs,
    timeEpochNs: timeEpochMs + '000000',
  };
}

/**
 * Converts dataFrames into LogsModel. This involves merging them into one list, sorting them and computing metadata
 * like common labels.
 */
export function logSeriesToLogsModel(logSeries: DataFrame[], queries: DataQuery[] = []): LogsModel | undefined {
  if (logSeries.length === 0) {
    return undefined;
  }
  const allLabels: Labels[][] = [];

  // Find the fields we care about and collect all labels
  let allSeries: LogInfo[] = [];

  // We are sometimes passing data frames with no fields because we want to calculate correct meta stats.
  // Therefore we need to filter out series with no fields. These series are used only for meta stats calculation.
  const seriesWithFields = logSeries.filter((series) => series.fields.length);

  if (seriesWithFields.length) {
    seriesWithFields.forEach((series) => {
      const logsFrame = parseLogsFrame(series);
      if (logsFrame != null) {
        // for now we ignore the nested-ness of attributes, and just stringify-them
        const frameLabels = logsFrame.getAttributesAsLabels() ?? undefined;
        const info = {
          rawFrame: series,
          logsFrame: logsFrame,
          frameLabels,
        };

        allSeries.push(info);
        if (frameLabels && frameLabels.length > 0) {
          allLabels.push(frameLabels);
        }
      }
    });
  }

  const flatAllLabels = allLabels.flat();
  const commonLabels = flatAllLabels.length > 0 ? findCommonLabels(flatAllLabels) : {};

  const rows: LogRowModel[] = [];
  let hasUniqueLabels = false;

  for (const info of allSeries) {
    const { logsFrame, rawFrame: series, frameLabels } = info;
    const { timeField, timeNanosecondField, bodyField: stringField, severityField: logLevelField, idField } = logsFrame;

    for (let j = 0; j < series.length; j++) {
      const { ts, timeEpochMs, timeEpochNs } = parseTime(timeField, timeNanosecondField ?? undefined, j);

      // In edge cases, this can be undefined. If undefined, we want to replace it with empty string.
      const messageValue: unknown = stringField.values[j] ?? '';
      // This should be string but sometimes isn't (eg elastic) because the dataFrame is not strongly typed.
      const message: string = typeof messageValue === 'string' ? messageValue : JSON.stringify(messageValue);

      const hasAnsi = textUtil.hasAnsiCodes(message);

      const hasUnescapedContent = !!message.match(/\\n|\\t|\\r/);

      // Data sources that set up searchWords on backend use meta.custom.searchWords
      // Data sources that set up searchWords through frontend can use meta.searchWords
      const searchWords = series.meta?.custom?.searchWords ?? series.meta?.searchWords ?? [];
      const entry = hasAnsi ? ansicolor.strip(message) : message;

      const labels = frameLabels?.[j];
      const uniqueLabels = findUniqueLabels(labels, commonLabels);
      if (Object.keys(uniqueLabels).length > 0) {
        hasUniqueLabels = true;
      }

      let logLevel = LogLevel.unknown;
      const logLevelKey = (logLevelField && logLevelField.values[j]) || (labels && labels['level']);
      if (logLevelKey) {
        logLevel = getLogLevelFromKey(logLevelKey);
      } else {
        logLevel = getLogLevel(entry);
      }

      const datasourceType = queries.find((query) => query.refId === series.refId)?.datasource?.type;

      rows.push({
        entryFieldIndex: stringField.index,
        rowIndex: j,
        dataFrame: series,
        logLevel,
        timeFromNow: dateTimeFormatTimeAgo(ts),
        timeEpochMs,
        timeEpochNs,
        timeLocal: dateTimeFormat(ts, { timeZone: 'browser' }),
        timeUtc: dateTimeFormat(ts, { timeZone: 'utc' }),
        uniqueLabels,
        hasAnsi,
        hasUnescapedContent,
        searchWords,
        entry,
        raw: message,
        labels: labels || {},
        // prepend refId to uid to make it unique across all series in a case when series contain duplicates
        uid: `${series.refId}_${idField ? idField.values[j] : j.toString()}`,
        datasourceType,
      });
    }
  }

  // Meta data to display in status
  const meta: LogsMetaItem[] = [];
  if (size(commonLabels) > 0) {
    meta.push({
      label: COMMON_LABELS,
      value: commonLabels,
      kind: LogsMetaKind.LabelsMap,
    });
  }
  // Data sources that set up searchWords on backend use meta.custom.limit.
  // Data sources that set up searchWords through frontend can use meta.limit.
  const limits = logSeries.filter((series) => series?.meta?.custom?.limit ?? series?.meta?.limit);
  const lastLimitPerRef = limits.reduce<Record<string, number>>((acc, elem) => {
    acc[elem.refId ?? ''] = elem.meta?.custom?.limit ?? elem.meta?.limit ?? 0;

    return acc;
  }, {});

  const limitValue = Object.values(lastLimitPerRef).reduce((acc, elem) => (acc += elem), 0);

  if (limitValue > 0) {
    meta.push({
      label: LIMIT_LABEL,
      value: limitValue,
      kind: LogsMetaKind.Number,
    });
  }

  let totalBytes = 0;
  const queriesVisited: { [refId: string]: boolean } = {};
  // To add just 1 error message
  let errorMetaAdded = false;

  for (const series of logSeries) {
    const totalBytesKey = series.meta?.custom?.lokiQueryStatKey;
    const { refId } = series; // Stats are per query, keeping track by refId

    if (!errorMetaAdded && series.meta?.custom?.error) {
      meta.push({
        label: '',
        value: series.meta?.custom.error,
        kind: LogsMetaKind.Error,
      });
      errorMetaAdded = true;
    }

    if (refId && !queriesVisited[refId]) {
      if (totalBytesKey && series.meta?.stats) {
        const byteStat = series.meta.stats.find((stat) => stat.displayName === totalBytesKey);
        if (byteStat) {
          totalBytes += byteStat.value;
        }
      }

      queriesVisited[refId] = true;
    }
  }

  if (totalBytes > 0) {
    const { text, suffix } = SIPrefix('B')(totalBytes);
    meta.push({
      label: 'Total bytes processed',
      value: `${text} ${suffix}`,
      kind: LogsMetaKind.String,
    });
  }

  return {
    hasUniqueLabels,
    meta,
    rows,
  };
}

// Used to add additional information to Line limit meta info
function adjustMetaInfo(logsModel: LogsModel, visibleRangeMs?: number, requestedRangeMs?: number): LogsMetaItem[] {
  let logsModelMeta = [...logsModel.meta!];

  const limitIndex = logsModelMeta.findIndex((meta) => meta.label === LIMIT_LABEL);
  const limit = limitIndex >= 0 && logsModelMeta[limitIndex]?.value;

  if (limit && limit > 0) {
    let metaLimitValue;

    if (limit === logsModel.rows.length && visibleRangeMs && requestedRangeMs) {
      const coverage = ((visibleRangeMs / requestedRangeMs) * 100).toFixed(2);

      metaLimitValue = `${limit} reached, received logs cover ${coverage}% (${rangeUtil.msRangeToTimeString(
        visibleRangeMs
      )}) of your selected time range (${rangeUtil.msRangeToTimeString(requestedRangeMs)})`;
    } else {
      metaLimitValue = `${limit} (${logsModel.rows.length} returned)`;
    }

    logsModelMeta[limitIndex] = {
      label: LIMIT_LABEL,
      value: metaLimitValue,
      kind: LogsMetaKind.String,
    };
  }

  return logsModelMeta;
}

/**
 * Returns field configuration used to render logs volume bars
 */
function getLogVolumeFieldConfig(level: LogLevel, oneLevelDetected: boolean) {
  const name = oneLevelDetected && level === LogLevel.unknown ? 'logs' : level;
  const color = LogLevelColor[level];
  return {
    displayNameFromDS: name,
    color: {
      mode: FieldColorModeId.Fixed,
      fixedColor: color,
    },
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      barAlignment: BarAlignment.Center,
      lineColor: color,
      pointColor: color,
      fillColor: color,
      lineWidth: 1,
      fillOpacity: 100,
      stacking: {
        mode: StackingMode.Normal,
        group: 'A',
      },
    },
  };
}

const updateLogsVolumeConfig = (
  dataFrame: DataFrame,
  extractLevel: (dataFrame: DataFrame) => LogLevel,
  oneLevelDetected: boolean
): DataFrame => {
  dataFrame.fields = dataFrame.fields.map((field) => {
    if (field.type === FieldType.number) {
      field.config = {
        ...field.config,
        ...getLogVolumeFieldConfig(extractLevel(dataFrame), oneLevelDetected),
      };
    }
    return field;
  });
  return dataFrame;
};

type LogsVolumeQueryOptions<T extends DataQuery> = {
  extractLevel: (dataFrame: DataFrame) => LogLevel;
  targets: T[];
  range: TimeRange;
};

/**
 * Creates an observable, which makes requests to get logs volume and aggregates results.
 */
export function queryLogsVolume<TQuery extends DataQuery, TOptions extends DataSourceJsonData>(
  datasource: DataSourceApi<TQuery, TOptions>,
  logsVolumeRequest: DataQueryRequest<TQuery>,
  options: LogsVolumeQueryOptions<TQuery>
): Observable<DataQueryResponse> {
  const timespan = options.range.to.valueOf() - options.range.from.valueOf();
  const intervalInfo = getIntervalInfo(logsVolumeRequest.scopedVars, timespan);

  logsVolumeRequest.interval = intervalInfo.interval;
  logsVolumeRequest.scopedVars.__interval = { value: intervalInfo.interval, text: intervalInfo.interval };

  if (intervalInfo.intervalMs !== undefined) {
    logsVolumeRequest.intervalMs = intervalInfo.intervalMs;
    logsVolumeRequest.scopedVars.__interval_ms = { value: intervalInfo.intervalMs, text: intervalInfo.intervalMs };
  }

  logsVolumeRequest.hideFromInspector = true;

  return new Observable((observer) => {
    let logsVolumeData: DataFrame[] = [];
    observer.next({
      state: LoadingState.Loading,
      error: undefined,
      data: [],
    });

    const queryResponse = datasource.query(logsVolumeRequest);
    const queryObservable = isObservable(queryResponse) ? queryResponse : from(queryResponse);

    const subscription = queryObservable.subscribe({
      complete: () => {
        observer.complete();
      },
      next: (dataQueryResponse: DataQueryResponse) => {
        const { error } = dataQueryResponse;
        if (error !== undefined) {
          observer.next({
            state: LoadingState.Error,
            error,
            data: [],
          });
          observer.error(error);
        } else {
          const framesByRefId = groupBy(dataQueryResponse.data, 'refId');
          logsVolumeData = dataQueryResponse.data.map((dataFrame) => {
            let sourceRefId = dataFrame.refId || '';
            if (sourceRefId.startsWith('log-volume-')) {
              sourceRefId = sourceRefId.substr('log-volume-'.length);
            }

            const logsVolumeCustomMetaData: LogsVolumeCustomMetaData = {
              logsVolumeType: LogsVolumeType.FullRange,
              absoluteRange: { from: options.range.from.valueOf(), to: options.range.to.valueOf() },
              datasourceName: datasource.name,
              sourceQuery: options.targets.find((dataQuery) => dataQuery.refId === sourceRefId)!,
            };

            dataFrame.meta = {
              ...dataFrame.meta,
              custom: {
                ...dataFrame.meta?.custom,
                ...logsVolumeCustomMetaData,
              },
            };
            return updateLogsVolumeConfig(dataFrame, options.extractLevel, framesByRefId[dataFrame.refId].length === 1);
          });

          observer.next({
            state: dataQueryResponse.state,
            error: undefined,
            data: logsVolumeData,
          });
        }
      },
      error: (error) => {
        observer.next({
          state: LoadingState.Error,
          error: error,
          data: [],
        });
        observer.error(error);
      },
    });
    return () => {
      subscription?.unsubscribe();
    };
  });
}

/**
 * Creates an observable, which makes requests to get logs sample.
 */
export function queryLogsSample<TQuery extends DataQuery, TOptions extends DataSourceJsonData>(
  datasource: DataSourceApi<TQuery, TOptions>,
  logsSampleRequest: DataQueryRequest<TQuery>
): Observable<DataQueryResponse> {
  logsSampleRequest.hideFromInspector = true;

  return new Observable((observer) => {
    let rawLogsSample: DataFrame[] = [];
    observer.next({
      state: LoadingState.Loading,
      error: undefined,
      data: [],
    });

    const queryResponse = datasource.query(logsSampleRequest);
    const queryObservable = isObservable(queryResponse) ? queryResponse : from(queryResponse);

    const subscription = queryObservable.subscribe({
      complete: () => {
        observer.next({
          state: LoadingState.Done,
          error: undefined,
          data: rawLogsSample,
        });
        observer.complete();
      },
      next: (dataQueryResponse: DataQueryResponse) => {
        const { error } = dataQueryResponse;
        if (error !== undefined) {
          observer.next({
            state: LoadingState.Error,
            error,
            data: [],
          });
          observer.error(error);
        } else {
          rawLogsSample = dataQueryResponse.data.map((dataFrame) => {
            const frame = toDataFrame(dataFrame);
            const { timeIndex } = getTimeField(frame);
            return sortDataFrame(frame, timeIndex);
          });
        }
      },
      error: (error) => {
        observer.next({
          state: LoadingState.Error,
          error: error,
          data: [],
        });
        observer.error(error);
      },
    });
    return () => {
      subscription?.unsubscribe();
    };
  });
}

function getIntervalInfo(scopedVars: ScopedVars, timespanMs: number): { interval: string; intervalMs?: number } {
  if (scopedVars.__interval_ms) {
    let intervalMs: number = scopedVars.__interval_ms.value;
    let interval = '';
    // below 5 seconds we force the resolution to be per 1ms as interval in scopedVars is not less than 10ms
    if (timespanMs < SECOND * 5) {
      intervalMs = MILLISECOND;
      interval = '1ms';
    } else if (intervalMs > HOUR) {
      intervalMs = DAY;
      interval = '1d';
    } else if (intervalMs > MINUTE) {
      intervalMs = HOUR;
      interval = '1h';
    } else if (intervalMs > SECOND) {
      intervalMs = MINUTE;
      interval = '1m';
    } else {
      intervalMs = SECOND;
      interval = '1s';
    }

    return { interval, intervalMs };
  } else {
    return { interval: '$__interval' };
  }
}
