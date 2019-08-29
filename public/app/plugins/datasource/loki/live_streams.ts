import {
  AppendingVector,
  DataFrame,
  Labels,
  CircularVector,
  FieldType,
  parseLabels,
  findUniqueLabels,
  KeyValue,
} from '@grafana/data';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { LokiLogsStream } from './types';
import { map } from 'rxjs/operators';

export interface BufferedData {
  // Direct Access
  times: AppendingVector<string>;
  lines: AppendingVector<string>;
  labels: AppendingVector<Labels>;

  // Structured
  frame: DataFrame;
}

/**
 * Maps directly to a query in the UI (refId is key)
 */
export interface LiveTarget {
  query: string;
  regexp: string;
  url: string;
  refId: string;
  size: number;
}

export class LiveStreams {
  private streams: KeyValue<Subject<DataFrame[]>> = {};

  observe(target: LiveTarget): Observable<DataFrame[]> {
    let stream = this.streams[target.url];
    if (!stream) {
      const times = new CircularVector<string>({ capacity: target.size });
      const lines = new CircularVector<string>({ capacity: target.size });
      const labels = new CircularVector<Labels>({ capacity: target.size });
      const data = {
        times,
        lines,
        labels,
        frame: {
          labels: parseLabels(target.query),
          fields: [
            { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
            { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
            { name: 'labels', type: FieldType.other, config: {}, values: labels }, // Labels
          ],
          length: 0, // will be updated after values are added
        },
      };

      const subject = new BehaviorSubject<DataFrame[]>([]);
      webSocket(target.url)
        .pipe(
          map((response: any) => {
            appendResponseToBufferedData(response, data);
            return [data.frame];
          })
        )
        .subscribe(subject);
      stream = this.streams[target.url] = subject;
    }
    return stream.asObservable();
  }
}

/**
 * This takes the streaming entries from the response and adds them to a
 * rolling buffer saved in liveTarget.
 */
export function appendResponseToBufferedData(response: any, data: BufferedData) {
  // Should we do anythign with: response.dropped_entries?

  const streams: LokiLogsStream[] = response.streams;
  if (streams && streams.length) {
    for (const stream of streams) {
      // Find unique labels
      const labels = parseLabels(stream.labels);
      const unique = findUniqueLabels(labels, data.frame.labels);

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
