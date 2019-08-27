import {
  AppendingVector,
  CircularVector,
  ArrayVector,
  KeyValue,
  parseLabels,
  DataFrame,
  FieldType,
} from '@grafana/data';
import { Subscription } from 'rxjs';

export interface BufferedData {
  // Direct Access
  times: AppendingVector<string>;
  lines: AppendingVector<string>;

  // Structured
  frame: DataFrame;
}

export interface LiveTarget {
  query: string;
  regexp: string;
  url: string; // use as unique key?
  refId: string;
  buffer: number; // the size buffer to hold for each label set
  isDelta?: boolean;

  data: KeyValue<BufferedData>;

  // WebSocket
  subscription?: Subscription;
}

export function getBufferedDataForLiveTarget(labels: string, target: LiveTarget) {
  const buffer = target.data[labels];
  if (buffer) {
    return buffer;
  }
  const isBuffered = !target.isDelta;
  const times = isBuffered ? new CircularVector<string>({ capacity: target.buffer }) : new ArrayVector<string>();
  const lines = isBuffered ? new CircularVector<string>({ capacity: target.buffer }) : new ArrayVector<string>();

  return (target.data[labels] = {
    times,
    lines,
    frame: {
      refId: target.refId,
      labels: parseLabels(labels),
      fields: [
        { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
        { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
      ],
      length: 0, // will be filled in later
    },
  });
}
