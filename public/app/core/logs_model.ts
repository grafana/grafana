import _ from 'lodash';
import { colors, ansicolor } from '@grafana/ui';

import {
  Labels,
  LogLevel,
  DataFrame,
  findCommonLabels,
  findUniqueLabels,
  getLogLevel,
  FieldType,
  getLogLevelFromKey,
  LogRowModel,
  LogsModel,
  LogsMetaItem,
  LogsMetaKind,
  LogsDedupStrategy,
  GraphSeriesXY,
  dateTimeFormat,
  dateTimeFormatTimeAgo,
  NullValueMode,
  toDataFrame,
  FieldCache,
  FieldWithIndex,
  getFlotPairs,
  TimeZone,
  getDisplayProcessor,
  textUtil,
  dateTime,
} from '@grafana/data';
import { getThemeColor } from 'app/core/utils/colors';

import { sortInAscendingOrder, deduplicateLogRowsById } from 'app/core/utils/explore';
import { getGraphSeriesModel } from 'app/plugins/panel/graph2/getGraphSeriesModel';
import { decimalSIPrefix } from '@grafana/data/src/valueFormats/symbolFormatters';

export const LogLevelColor = {
  [LogLevel.critical]: colors[7],
  [LogLevel.warning]: colors[1],
  [LogLevel.error]: colors[4],
  [LogLevel.info]: colors[0],
  [LogLevel.debug]: colors[5],
  [LogLevel.trace]: colors[2],
  [LogLevel.unknown]: getThemeColor('#8e8e8e', '#dde4ed'),
};

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

export function makeSeriesForLogs(rows: LogRowModel[], intervalMs: number, timeZone: TimeZone): GraphSeriesXY[] {
  // currently interval is rangeMs / resolution, which is too low for showing series as bars.
  // need at least 10px per bucket, so we multiply interval by 10. Should be solved higher up the chain
  // when executing queries & interval calculated and not here but this is a temporary fix.
  // intervalMs = intervalMs * 10;

  // Graph time series by log level
  const seriesByLevel: any = {};
  const bucketSize = intervalMs * 10;
  const seriesList: any[] = [];

  const sortedRows = rows.sort(sortInAscendingOrder);
  for (const row of sortedRows) {
    let series = seriesByLevel[row.logLevel];

    if (!series) {
      seriesByLevel[row.logLevel] = series = {
        lastTs: null,
        datapoints: [],
        alias: row.logLevel,
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

    // EEEP: converts GraphSeriesXY to DataFrame and back again!
    const data = toDataFrame(series);
    const fieldCache = new FieldCache(data);

    const timeField = fieldCache.getFirstFieldOfType(FieldType.time);
    timeField.display = getDisplayProcessor({
      field: timeField,
      timeZone,
    });

    const valueField = fieldCache.getFirstFieldOfType(FieldType.number);
    valueField.config = {
      ...valueField.config,
      color: series.color,
    };
    valueField.name = series.alias;
    const fieldDisplayProcessor = getDisplayProcessor({ field: valueField, timeZone });
    valueField.display = (value: any) => ({ ...fieldDisplayProcessor(value), color: series.color });

    const points = getFlotPairs({
      xField: timeField,
      yField: valueField,
      nullValueMode: NullValueMode.Null,
    });

    const graphSeries: GraphSeriesXY = {
      color: series.color,
      label: series.alias,
      data: points,
      isVisible: true,
      yAxis: {
        index: 1,
        min: 0,
        tickDecimals: 0,
      },
      seriesIndex: i,
      timeField,
      valueField,
      // for now setting the time step to be 0,
      // and handle the bar width by setting lineWidth instead of barWidth in flot options
      timeStep: 0,
    };

    return graphSeries;
  });
}

function isLogsData(series: DataFrame) {
  return series.fields.some(f => f.type === FieldType.time) && series.fields.some(f => f.type === FieldType.string);
}

/**
 * Convert dataFrame into LogsModel which consists of creating separate array of log rows and metrics series. Metrics
 * series can be either already included in the dataFrame or will be computed from the log rows.
 * @param dataFrame
 * @param intervalMs In case there are no metrics series, we use this for computing it from log rows.
 */
export function dataFrameToLogsModel(
  dataFrame: DataFrame[],
  intervalMs: number | undefined,
  timeZone: TimeZone
): LogsModel {
  const { logSeries, metricSeries } = separateLogsAndMetrics(dataFrame);
  const logsModel = logSeriesToLogsModel(logSeries);

  if (logsModel) {
    if (metricSeries.length === 0) {
      // Create metrics from logs
      // If interval is not defined or 0 we cannot really compute the series
      logsModel.series = intervalMs ? makeSeriesForLogs(logsModel.rows, intervalMs, timeZone) : [];
    } else {
      // We got metrics in the dataFrame so process those
      logsModel.series = getGraphSeriesModel(
        metricSeries,
        timeZone,
        {},
        { showBars: true, showLines: false, showPoints: false },
        {
          asTable: false,
          isVisible: true,
          placement: 'under',
        }
      );
    }

    return logsModel;
  }

  return {
    hasUniqueLabels: false,
    rows: [],
    meta: [],
    series: [],
  };
}

function separateLogsAndMetrics(dataFrames: DataFrame[]) {
  const metricSeries: DataFrame[] = [];
  const logSeries: DataFrame[] = [];

  for (const dataFrame of dataFrames) {
    if (isLogsData(dataFrame)) {
      logSeries.push(dataFrame);
      continue;
    }

    if (dataFrame.length > 0) {
      metricSeries.push(dataFrame);
    }
  }

  return { logSeries, metricSeries };
}

interface LogFields {
  series: DataFrame;

  timeField: FieldWithIndex;
  stringField: FieldWithIndex;
  timeNanosecondField?: FieldWithIndex;
  logLevelField?: FieldWithIndex;
  idField?: FieldWithIndex;
}

/**
 * Converts dataFrames into LogsModel. This involves merging them into one list, sorting them and computing metadata
 * like common labels.
 */
export function logSeriesToLogsModel(logSeries: DataFrame[]): LogsModel | undefined {
  if (logSeries.length === 0) {
    return undefined;
  }
  const allLabels: Labels[] = [];

  // Find the fields we care about and collect all labels
  const allSeries: LogFields[] = logSeries.map(series => {
    const fieldCache = new FieldCache(series);

    const stringField = fieldCache.hasFieldNamed('line')
      ? fieldCache.getFieldByName('line')
      : fieldCache.getFirstFieldOfType(FieldType.string);
    if (stringField?.labels) {
      allLabels.push(stringField.labels);
    }
    return {
      series,
      timeField: fieldCache.getFirstFieldOfType(FieldType.time),
      timeNanosecondField: fieldCache.hasFieldWithNameAndType('tsNs', FieldType.time)
        ? fieldCache.getFieldByName('tsNs')
        : undefined,
      stringField,
      logLevelField: fieldCache.getFieldByName('level'),
      idField: getIdField(fieldCache),
    } as LogFields;
  });

  const commonLabels = allLabels.length > 0 ? findCommonLabels(allLabels) : {};

  const rows: LogRowModel[] = [];
  let hasUniqueLabels = false;

  for (const info of allSeries) {
    const { timeField, timeNanosecondField, stringField, logLevelField, idField, series } = info;
    const labels = stringField.labels;
    const uniqueLabels = findUniqueLabels(labels, commonLabels);
    if (Object.keys(uniqueLabels).length > 0) {
      hasUniqueLabels = true;
    }

    let seriesLogLevel: LogLevel | undefined = undefined;
    if (labels && Object.keys(labels).indexOf('level') !== -1) {
      seriesLogLevel = getLogLevelFromKey(labels['level']);
    }

    for (let j = 0; j < series.length; j++) {
      const ts = timeField.values.get(j);
      const time = dateTime(ts);
      const tsNs = timeNanosecondField ? timeNanosecondField.values.get(j) : undefined;
      const timeEpochNs = tsNs ? tsNs : time.valueOf() + '000000';

      const messageValue: unknown = stringField.values.get(j);
      // This should be string but sometimes isn't (eg elastic) because the dataFrame is not strongly typed.
      const message: string = typeof messageValue === 'string' ? messageValue : JSON.stringify(messageValue);

      const hasAnsi = textUtil.hasAnsiCodes(message);
      const searchWords = series.meta && series.meta.searchWords ? series.meta.searchWords : [];

      let logLevel = LogLevel.unknown;
      if (logLevelField && logLevelField.values.get(j)) {
        logLevel = getLogLevelFromKey(logLevelField.values.get(j));
      } else if (seriesLogLevel) {
        logLevel = seriesLogLevel;
      } else {
        logLevel = getLogLevel(message);
      }
      rows.push({
        entryFieldIndex: stringField.index,
        rowIndex: j,
        dataFrame: series,
        logLevel,
        timeFromNow: dateTimeFormatTimeAgo(ts),
        timeEpochMs: time.valueOf(),
        timeEpochNs,
        timeLocal: dateTimeFormat(ts, { timeZone: 'browser' }),
        timeUtc: dateTimeFormat(ts, { timeZone: 'utc' }),
        uniqueLabels,
        hasAnsi,
        searchWords,
        entry: hasAnsi ? ansicolor.strip(message) : message,
        raw: message,
        labels: stringField.labels || {},
        uid: idField ? idField.values.get(j) : j.toString(),
      });
    }
  }

  const deduplicatedLogRows = deduplicateLogRowsById(rows);

  // Meta data to display in status
  const meta: LogsMetaItem[] = [];
  if (_.size(commonLabels) > 0) {
    meta.push({
      label: 'Common labels',
      value: commonLabels,
      kind: LogsMetaKind.LabelsMap,
    });
  }

  const limits = logSeries.filter(series => series.meta && series.meta.limit);
  const limitValue = Object.values(
    limits.reduce((acc: any, elem: any) => {
      acc[elem.refId] = elem.meta.limit;
      return acc;
    }, {})
  ).reduce((acc: number, elem: any) => (acc += elem), 0);

  if (limits.length > 0) {
    meta.push({
      label: 'Limit',
      value: `${limitValue} (${deduplicatedLogRows.length} returned)`,
      kind: LogsMetaKind.String,
    });
  }

  // Hack to print loki stats in Explore. Should be using proper stats display via drawer in Explore (rework in 7.1)
  let totalBytes = 0;
  const queriesVisited: { [refId: string]: boolean } = {};
  for (const series of logSeries) {
    const totalBytesKey = series.meta?.custom?.lokiQueryStatKey;
    // Stats are per query, keeping track by refId
    const { refId } = series;
    if (refId && !queriesVisited[refId]) {
      if (totalBytesKey && series.meta.stats) {
        const byteStat = series.meta.stats.find(stat => stat.displayName === totalBytesKey);
        if (byteStat) {
          totalBytes += byteStat.value;
        }
      }
      queriesVisited[refId] = true;
    }
  }
  if (totalBytes > 0) {
    const { text, suffix } = decimalSIPrefix('B')(totalBytes);
    meta.push({
      label: 'Total bytes processed',
      value: `${text} ${suffix}`,
      kind: LogsMetaKind.String,
    });
  }

  return {
    hasUniqueLabels,
    meta,
    rows: deduplicatedLogRows,
  };
}

function getIdField(fieldCache: FieldCache): FieldWithIndex | undefined {
  const idFieldNames = ['id'];
  for (const fieldName of idFieldNames) {
    const idField = fieldCache.getFieldByName(fieldName);
    if (idField) {
      return idField;
    }
  }
  return undefined;
}
