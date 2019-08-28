import { LokiLogsStream } from './types';
import { parseLabels, FieldType, Labels, DataFrame, ArrayVector, findUniqueLabels } from '@grafana/data';
import { LiveTarget } from './live_target';

export function logStreamToDataFrame(stream: LokiLogsStream, reverse?: boolean, refId?: string): DataFrame {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  const times = new ArrayVector<string>([]);
  const lines = new ArrayVector<string>([]);

  for (const entry of stream.entries) {
    times.add(entry.ts || entry.timestamp);
    lines.add(entry.line);
  }

  if (reverse) {
    times.buffer = times.buffer.reverse();
    lines.buffer = lines.buffer.reverse();
  }

  return {
    refId,
    labels,
    fields: [
      { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
      { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
    ],
    length: times.length,
  };
}

/**
 * This takes the streaming entries from the response and adds them to a
 * rolling buffer saved in liveTarget.
 */
export function appendResponseToLiveTarget(response: any, liveTarget: LiveTarget) {
  // Should we do anythign with: response.dropped_entries?

  const streams: LokiLogsStream[] = response.streams;
  if (streams && streams.length) {
    const { data, queryLabels } = liveTarget;
    for (const stream of streams) {
      // Find unique labels
      const labels = parseLabels(stream.labels);
      const unique = findUniqueLabels(queryLabels, labels);

      // Add each line
      for (const entry of stream.entries) {
        data.times.add(entry.ts || entry.timestamp);
        data.lines.add(entry.line);
        data.labels.add(unique);
      }
    }
    data.frame.length = data.times.length;
  }
}
