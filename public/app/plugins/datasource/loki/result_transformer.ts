import ansicolor from 'vendor/ansicolor/ansicolor';
import _ from 'lodash';
import moment from 'moment';

import {
  LogLevel,
  LogsMetaItem,
  LogsModel,
  LogRowModel,
  LogsStream,
  LogsStreamEntry,
  LogsStreamLabels,
  LogsMetaKind,
} from 'app/core/logs_model';
import { hasAnsiCodes } from 'app/core/utils/text';
import { DEFAULT_MAX_LINES } from './datasource';

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
  let level: LogLevel;
  Object.keys(LogLevel).forEach(key => {
    if (!level) {
      const regexp = new RegExp(`\\b${key}\\b`, 'i');
      if (regexp.test(line)) {
        level = LogLevel[key];
      }
    }
  });
  if (!level) {
    level = LogLevel.unknown;
  }
  return level;
}

/**
 * Regexp to extract Prometheus-style labels
 */
const labelRegexp = /\b(\w+)(!?=~?)"([^"\n]*?)"/g;

/**
 * Returns a map of label keys to value from an input selector string.
 *
 * Example: `parseLabels('{job="foo", instance="bar"}) // {job: "foo", instance: "bar"}`
 */
export function parseLabels(labels: string): LogsStreamLabels {
  const labelsByKey: LogsStreamLabels = {};
  labels.replace(labelRegexp, (_, key, operator, value) => {
    labelsByKey[key] = value;
    return '';
  });
  return labelsByKey;
}

/**
 * Returns a map labels that are common to the given label sets.
 */
export function findCommonLabels(labelsSets: LogsStreamLabels[]): LogsStreamLabels {
  return labelsSets.reduce((acc, labels) => {
    if (!labels) {
      throw new Error('Need parsed labels to find common labels.');
    }
    if (!acc) {
      // Initial set
      acc = { ...labels };
    } else {
      // Remove incoming labels that are missing or not matching in value
      Object.keys(labels).forEach(key => {
        if (acc[key] === undefined || acc[key] !== labels[key]) {
          delete acc[key];
        }
      });
      // Remove common labels that are missing from incoming label set
      Object.keys(acc).forEach(key => {
        if (labels[key] === undefined) {
          delete acc[key];
        }
      });
    }
    return acc;
  }, undefined);
}

/**
 * Returns a map of labels that are in `labels`, but not in `commonLabels`.
 */
export function findUniqueLabels(labels: LogsStreamLabels, commonLabels: LogsStreamLabels): LogsStreamLabels {
  const uncommonLabels: LogsStreamLabels = { ...labels };
  Object.keys(commonLabels).forEach(key => {
    delete uncommonLabels[key];
  });
  return uncommonLabels;
}

/**
 * Serializes the given labels to a string.
 */
export function formatLabels(labels: LogsStreamLabels, defaultValue = ''): string {
  if (!labels || Object.keys(labels).length === 0) {
    return defaultValue;
  }
  const labelKeys = Object.keys(labels).sort();
  const cleanSelector = labelKeys.map(key => `${key}="${labels[key]}"`).join(', ');
  return ['{', cleanSelector, '}'].join('');
}

export function processEntry(
  entry: LogsStreamEntry,
  labels: string,
  parsedLabels: LogsStreamLabels,
  uniqueLabels: LogsStreamLabels,
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
