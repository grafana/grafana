import { LokiLogsStream, LokiResponse } from './types';
import {
  parseLabels,
  FieldType,
  Labels,
  DataFrame,
  ArrayVector,
  MutableDataFrame,
  findUniqueLabels,
} from '@grafana/data';

/**
 * Transforms LokiLogStream structure into a dataFrame. Used when doing standard queries.
 */
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
 * Transform LokiResponse data and appends it to MutableDataFrame. Used for streaming where the dataFrame can be
 * a CircularDataFrame creating a fixed size rolling buffer.
 * TODO: Probably could be unified with the logStreamToDataFrame function.
 */
export function appendResponseToBufferedData(response: LokiResponse, data: MutableDataFrame) {
  // Should we do anythign with: response.dropped_entries?

  const streams: LokiLogsStream[] = response.streams;
  if (streams && streams.length) {
    for (const stream of streams) {
      // Find unique labels
      const labels = parseLabels(stream.labels);
      const unique = findUniqueLabels(labels, data.labels);

      // Add each line
      for (const entry of stream.entries) {
        data.values.ts.add(entry.ts || entry.timestamp);
        data.values.line.add(entry.line);
        data.values.labels.add(unique);
      }
    }
  }
}
