import _ from 'lodash';
import moment from 'moment';

import { LogLevel, LogsMetaItem, LogsModel, LogRow, LogsStream } from 'app/core/logs_model';
import { TimeSeries } from 'app/core/core';
import colors from 'app/core/utils/colors';

export function getLogLevel(line: string): LogLevel {
  if (!line) {
    return undefined;
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
  return level;
}

const labelRegexp = /\b(\w+)(!?=~?)("[^"\n]*?")/g;
export function parseLabels(labels: string): { [key: string]: string } {
  const labelsByKey = {};
  labels.replace(labelRegexp, (_, key, operator, value) => {
    labelsByKey[key] = value;
    return '';
  });
  return labelsByKey;
}

export function findCommonLabels(labelsSets: any[]) {
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

export function findUncommonLabels(labels, commonLabels) {
  const uncommonLabels = { ...labels };
  Object.keys(commonLabels).forEach(key => {
    delete uncommonLabels[key];
  });
  return uncommonLabels;
}

export function formatLabels(labels, defaultValue = '') {
  if (!labels || Object.keys(labels).length === 0) {
    return defaultValue;
  }
  const labelKeys = Object.keys(labels).sort();
  const cleanSelector = labelKeys.map(key => `${key}=${labels[key]}`).join(', ');
  return ['{', cleanSelector, '}'].join('');
}

export function processEntry(entry: { line: string; timestamp: string }, stream): LogRow {
  const { line, timestamp } = entry;
  const { labels } = stream;
  const key = `EK${timestamp}${labels}`;
  const time = moment(timestamp);
  const timeJs = time.valueOf();
  const timeFromNow = time.fromNow();
  const timeLocal = time.format('YYYY-MM-DD HH:mm:ss');
  const logLevel = getLogLevel(line);

  return {
    key,
    logLevel,
    timeFromNow,
    timeJs,
    timeLocal,
    entry: line,
    labels: formatLabels(labels),
    searchWords: [stream.search],
    timestamp: timestamp,
  };
}

export function mergeStreams(streams: LogsStream[], limit?: number): LogsModel {
  // Find meta data
  const commonLabels = findCommonLabels(streams.map(stream => stream.parsedLabels));
  const meta: LogsMetaItem[] = [
    {
      label: 'Common labels',
      value: formatLabels(commonLabels),
    },
  ];

  // Flatten entries of streams
  const combinedEntries = streams.reduce((acc, stream) => {
    // Overwrite labels to be only the non-common ones
    const labels = formatLabels(findUncommonLabels(stream.parsedLabels, commonLabels));
    return [
      ...acc,
      ...stream.entries.map(entry => ({
        ...entry,
        labels,
      })),
    ];
  }, []);

  const commonLabelsAlias =
    streams.length === 1 ? formatLabels(commonLabels) : `Stream with common labels ${formatLabels(commonLabels)}`;
  const series = streams.map((stream, index) => {
    const colorIndex = index % colors.length;
    stream.graphSeries.setColor(colors[colorIndex]);
    stream.graphSeries.alias = formatLabels(findUncommonLabels(stream.parsedLabels, commonLabels), commonLabelsAlias);
    return stream.graphSeries;
  });

  const sortedEntries = _.chain(combinedEntries)
    .sortBy('timestamp')
    .reverse()
    .slice(0, limit || combinedEntries.length)
    .value();

  meta.push({
    label: 'Limit',
    value: `${limit} (${sortedEntries.length} returned)`,
  });

  return { meta, series, rows: sortedEntries };
}

export function processStream(stream: LogsStream, limit?: number, intervalMs?: number): LogsStream {
  const sortedEntries: any[] = _.chain(stream.entries)
    .map(entry => processEntry(entry, stream))
    .sortBy('timestamp')
    .reverse()
    .slice(0, limit || stream.entries.length)
    .value();

  // Build graph data
  let previousTime;
  const datapoints = sortedEntries.reduce((acc, entry, index) => {
    // Bucket to nearest minute
    const time = Math.round(entry.timeJs / intervalMs / 10) * intervalMs * 10;
    // Entry for time
    if (time === previousTime) {
      acc[acc.length - 1][0]++;
    } else {
      acc.push([1, time]);
      previousTime = time;
    }
    return acc;
  }, []);
  const graphSeries = new TimeSeries({ datapoints, alias: stream.labels });

  return {
    ...stream,
    graphSeries,
    entries: sortedEntries,
    parsedLabels: parseLabels(stream.labels),
  };
}
