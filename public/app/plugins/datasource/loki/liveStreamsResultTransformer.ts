import { v5 as uuidv5 } from 'uuid';

import { MutableDataFrame } from '@grafana/data';

import { LokiStreamResult, LokiTailResponse } from './types';

const UUID_NAMESPACE = '6ec946da-0f49-47a8-983a-1d76d17e7c92';

/**
 * Transform LokiResponse data and appends it to MutableDataFrame. Used for streaming where the dataFrame can be
 * a CircularDataFrame creating a fixed size rolling buffer.
 * TODO: Probably could be unified with the logStreamToDataFrame function.
 * @param response
 * @param data Needs to have ts, line, labels, id as fields
 */
export function appendResponseToBufferedData(response: LokiTailResponse, data: MutableDataFrame) {
  // Should we do anything with: response.dropped_entries?

  const streams: LokiStreamResult[] = response.streams;
  if (!streams || !streams.length) {
    return;
  }

  const tsField = data.fields[0];
  const lineField = data.fields[1];
  const idField = data.fields[2];

  // We are comparing used ids only within the received stream. This could be a problem if the same line + labels + nanosecond timestamp came in 2 separate batches.
  // As this is very unlikely, and the result would only affect live-tailing css animation we have decided to not compare all received uids from data param as this would slow down processing.
  const usedUids: Record<string, number> = {};

  for (const stream of streams) {
    // Find unique labels
    const allLabelsString = Object.entries(stream.stream)
      .map(([key, val]) => `${key}="${val}"`)
      .sort()
      .join('');

    // Add each line
    for (const [ts, line] of stream.values) {
      tsField.values.push(new Date(parseInt(ts.slice(0, -6), 10)).toISOString());
      lineField.values.push(line);
      idField.values.push(createUid(ts, allLabelsString, line, usedUids, data.refId));
    }
  }
}

function createUid(
  ts: string,
  labelsString: string,
  line: string,
  usedUids: Record<string, number>,
  refId?: string
): string {
  // Generate id as hashed nanosecond timestamp, labels and line (this does not have to be unique)
  let id = uuidv5(`${ts}_${labelsString}_${line}`, UUID_NAMESPACE);

  // Check if generated id is unique
  // If not and we've already used it, append its count after it
  if (id in usedUids) {
    // Increase the count
    const newCount = usedUids[id] + 1;
    usedUids[id] = newCount;
    // Append count to generated id to make it unique
    id = `${id}_${newCount}`;
  } else {
    // If id is unique and wasn't used, add it to usedUids and start count at 0
    usedUids[id] = 0;
  }
  // Return unique id
  if (refId) {
    return `${refId}_${id}`;
  }
  return id;
}
