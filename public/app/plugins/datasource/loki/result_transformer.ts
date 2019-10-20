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
  const uids = new ArrayVector<string>([]);

  for (const entry of stream.entries) {
    const ts = entry.ts || entry.timestamp;
    times.add(ts);
    lines.add(entry.line);
    uids.add(`${ts}_${stream.labels}`);
  }

  if (reverse) {
    times.buffer = times.buffer.reverse();
    lines.buffer = lines.buffer.reverse();
  }

  return {
    refId,
    fields: [
      { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
      { name: 'line', type: FieldType.string, config: {}, values: lines, labels }, // Line
      { name: 'id', type: FieldType.string, config: {}, values: uids },
    ],
    length: times.length,
  };
}

/**
 * Transform LokiResponse data and appends it to MutableDataFrame. Used for streaming where the dataFrame can be
 * a CircularDataFrame creating a fixed size rolling buffer.
 * TODO: Probably could be unified with the logStreamToDataFrame function.
 * @param response
 * @param data Needs to have ts, line, labels, id as fields
 */
export function appendResponseToBufferedData(response: LokiResponse, data: MutableDataFrame) {
  // Should we do anything with: response.dropped_entries?

  const streams: LokiLogsStream[] = response.streams;
  if (streams && streams.length) {
    const { values } = data;
    let baseLabels: Labels = {};
    for (const f of data.fields) {
      if (f.type === FieldType.string) {
        if (f.labels) {
          baseLabels = f.labels;
        }
        break;
      }
    }

    for (const stream of streams) {
      // Find unique labels
      const labels = parseLabels(stream.labels);
      const unique = findUniqueLabels(labels, baseLabels);

      // Add each line
      for (const entry of stream.entries) {
        const ts = entry.ts || entry.timestamp;
        values.ts.add(ts);
        values.line.add(entry.line);
        values.labels.add(unique);
        values.id.add(`${ts}_${stream.labels}`);
      }
    }
  }
}
