import _ from 'lodash';
import moment from 'moment';

import { LogLevel, LogsModel, LogRow } from 'app/core/logs_model';

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

export function getSearchMatches(line: string, search: string) {
  // Empty search can send re.exec() into infinite loop, exit early
  if (!line || !search) {
    return [];
  }
  const regexp = new RegExp(`(?:${search})`, 'g');
  const matches = [];
  let match;
  while ((match = regexp.exec(line))) {
    matches.push({
      text: match[0],
      start: match.index,
      length: match[0].length,
    });
  }
  return matches;
}

export function processEntry(entry: { line: string; timestamp: string }, stream): LogRow {
  const { line, timestamp } = entry;
  const { labels } = stream;
  const key = `EK${timestamp}${labels}`;
  const time = moment(timestamp);
  const timeFromNow = time.fromNow();
  const timeLocal = time.format('YYYY-MM-DD HH:mm:ss');
  const searchMatches = getSearchMatches(line, stream.search);
  const logLevel = getLogLevel(line);

  return {
    key,
    logLevel,
    searchMatches,
    timeFromNow,
    timeLocal,
    entry: line,
    timestamp: timestamp,
  };
}

export function processStreams(streams, limit?: number): LogsModel {
  const combinedEntries = streams.reduce((acc, stream) => {
    return [...acc, ...stream.entries.map(entry => processEntry(entry, stream))];
  }, []);
  const sortedEntries = _.chain(combinedEntries)
    .sortBy('timestamp')
    .reverse()
    .slice(0, limit || combinedEntries.length)
    .value();
  return { rows: sortedEntries };
}
