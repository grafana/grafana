import {
  DataFrame,
  MutableDataFrame,
  FieldType,
  parseLabels,
  findUniqueLabels,
  KeyValue,
  CircularDataFrame,
} from '@grafana/data';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { LokiLogsStream } from './types';
import { map } from 'rxjs/operators';

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
      const data = new CircularDataFrame({ capacity: target.size });
      (data.labels = parseLabels(target.query)),
        data.addField({ name: 'ts', type: FieldType.time, config: { title: 'Time' } });
      data.addField({ name: 'line', type: FieldType.string });
      data.addField({ name: 'labels', type: FieldType.other });

      const subject = new BehaviorSubject<DataFrame[]>([]);
      webSocket(target.url)
        .pipe(
          map((response: any) => {
            appendResponseToBufferedData(response, data);
            return [data];
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
export function appendResponseToBufferedData(response: any, data: MutableDataFrame) {
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
        data.values.lines.add(entry.line);
        data.values.labels.add(unique);
      }
    }
  }
}
