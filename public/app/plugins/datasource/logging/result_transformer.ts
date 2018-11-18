import _ from 'lodash';
import moment from 'moment';

import {
  LogLevel,
  LogsMetaItem,
  LogsModel,
  LogRow,
  LogsStream,
  LogsStreamEntry,
  LogsStreamLabels,
} from 'app/core/logs_model';
import { DEFAULT_LIMIT } from './datasource';

/**
 * Returns the log level of a log line.
 * Parse the line for level words. If no level is found, it returns `LogLevel.none`.
 *
 * Example: `getLogLevel('WARN 1999-12-31 this is great') // LogLevel.warn`
 */
export function getLogLevel(line: string): LogLevel {
  if (!line) {
    return LogLevel.none;
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
    level = LogLevel.none;
  }
  return level;
}

/**
 * Regexp to extract Prometheus-style labels
 */
const labelRegexp = /\b(\w+)(!?=~?)("[^"\n]*?")/g;

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
  const cleanSelector = labelKeys.map(key => `${key}=${labels[key]}`).join(', ');
  return ['{', cleanSelector, '}'].join('');
}

export function processEntry(entry: LogsStreamEntry, labels: string, uniqueLabels: string, search: string): LogRow {
  const { line, timestamp } = entry;
  // Assumes unique-ness, needs nanosec precision for timestamp
  const key = `EK${timestamp}${labels}`;
  const time = moment(timestamp);
  const timeEpochMs = time.valueOf();
  const timeFromNow = time.fromNow();
  const timeLocal = time.format('YYYY-MM-DD HH:mm:ss');
  const logLevel = getLogLevel(line);

  return {
    key,
    labels,
    logLevel,
    timeFromNow,
    timeEpochMs,
    timeLocal,
    uniqueLabels,
    entry: line,
    searchWords: search ? [search] : [],
    timestamp: timestamp,
  };
}

export function mergeStreamsToLogs(streams: LogsStream[], limit = DEFAULT_LIMIT): LogsModel {
  // Find unique labels for each stream
  streams = streams.map(stream => ({
    ...stream,
    parsedLabels: parseLabels(stream.labels),
  }));
  const commonLabels = findCommonLabels(streams.map(model => model.parsedLabels));
  streams = streams.map(stream => ({
    ...stream,
    uniqueLabels: formatLabels(findUniqueLabels(stream.parsedLabels, commonLabels)),
  }));

  // Merge stream entries into single list of log rows
  const sortedRows: LogRow[] = _.chain(streams)
    .reduce(
      (acc: LogRow[], stream: LogsStream) => [
        ...acc,
        ...stream.entries.map(entry => processEntry(entry, stream.labels, stream.uniqueLabels, stream.search)),
      ],
      []
    )
    .sortBy('timestamp')
    .reverse()
    .value();

  // Meta data to display in status
  const meta: LogsMetaItem[] = [];
  if (_.size(commonLabels) > 0) {
    meta.push({
      label: 'Common labels',
      value: formatLabels(commonLabels),
    });
  }
  if (limit) {
    meta.push({
      label: 'Limit',
      value: `${limit} (${sortedRows.length} returned)`,
    });
  }

  return {
    meta,
    rows: sortedRows,
  };
}
