import ansicolor from 'vendor/ansicolor/ansicolor';
import _ from 'lodash';
import moment from 'moment';

import { LogsMetaItem, LogsModel, LogRowModel, LogsStream, LogsStreamEntry, LogsMetaKind } from 'app/core/logs_model';
import { hasAnsiCodes } from 'app/core/utils/text';
import { DEFAULT_MAX_LINES } from './datasource';

import {
  parseLabels,
  SeriesData,
  findUniqueLabels,
  Labels,
  findCommonLabels,
  getLogLevel,
  FieldType,
  formatLabels,
  guessFieldTypeFromSeries,
} from '@grafana/ui';

export function processEntry(
  entry: LogsStreamEntry,
  labels: string,
  parsedLabels: Labels,
  uniqueLabels: Labels,
  search: string
): LogRowModel {
  const { line } = entry;
  const ts = entry.ts || entry.timestamp;
  // Assumes unique-ness, needs nanosec precision for timestamp
  const key = `EK${ts}${labels}`;
  const time = moment(ts);
  const timeEpochMs = time.valueOf();
  const timeFromNow = time.fromNow();
  const timeLocal = time.format('YYYY-MM-DD HH:mm:ss');
  const logLevel = getLogLevel(line);
  const hasAnsi = hasAnsiCodes(line);

  return {
    key,
    logLevel,
    timeFromNow,
    timeEpochMs,
    timeLocal,
    uniqueLabels,
    hasAnsi,
    entry: hasAnsi ? ansicolor.strip(line) : line,
    raw: line,
    labels: parsedLabels,
    searchWords: search ? [search] : [],
    timestamp: ts,
  };
}

export function mergeStreamsToLogs(streams: LogsStream[], limit = DEFAULT_MAX_LINES): LogsModel {
  // Unique model identifier
  const id = streams.map(stream => stream.labels).join();

  // Find unique labels for each stream
  streams = streams.map(stream => ({
    ...stream,
    parsedLabels: parseLabels(stream.labels),
  }));
  const commonLabels = findCommonLabels(streams.map(model => model.parsedLabels));
  streams = streams.map(stream => ({
    ...stream,
    uniqueLabels: findUniqueLabels(stream.parsedLabels, commonLabels),
  }));

  // Merge stream entries into single list of log rows
  const sortedRows: LogRowModel[] = _.chain(streams)
    .reduce(
      (acc: LogRowModel[], stream: LogsStream) => [
        ...acc,
        ...stream.entries.map(entry =>
          processEntry(entry, stream.labels, stream.parsedLabels, stream.uniqueLabels, stream.search)
        ),
      ],
      []
    )
    .sortBy('timestamp')
    .reverse()
    .value();

  const hasUniqueLabels = sortedRows && sortedRows.some(row => Object.keys(row.uniqueLabels).length > 0);

  // Meta data to display in status
  const meta: LogsMetaItem[] = [];
  if (_.size(commonLabels) > 0) {
    meta.push({
      label: 'Common labels',
      value: commonLabels,
      kind: LogsMetaKind.LabelsMap,
    });
  }
  if (limit) {
    meta.push({
      label: 'Limit',
      value: `${limit} (${sortedRows.length} returned)`,
      kind: LogsMetaKind.String,
    });
  }

  return {
    id,
    hasUniqueLabels,
    meta,
    rows: sortedRows,
  };
}

export function logStreamToSeriesData(stream: LogsStream): SeriesData {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  return {
    labels,
    fields: [{ name: 'ts', type: FieldType.time }, { name: 'line', type: FieldType.string }],
    rows: stream.entries.map(entry => {
      return [entry.ts || entry.timestamp, entry.line];
    }),
  };
}

export function seriesDataToLogStream(series: SeriesData): LogsStream {
  let timeIndex = -1;
  let lineIndex = -1;
  for (let i = 0; i < series.fields.length; i++) {
    const field = series.fields[i];
    const type = field.type || guessFieldTypeFromSeries(series, i);
    if (timeIndex < 0 && type === FieldType.time) {
      timeIndex = i;
    }
    if (lineIndex < 0 && type === FieldType.string) {
      lineIndex = i;
    }
  }
  if (timeIndex < 0) {
    throw new Error('Series does not have a time field');
  }
  if (lineIndex < 0) {
    throw new Error('Series does not have a line field');
  }
  return {
    labels: formatLabels(series.labels),
    parsedLabels: series.labels,
    entries: series.rows.map(row => {
      return {
        line: row[lineIndex],
        ts: row[timeIndex],
      };
    }),
  };
}
