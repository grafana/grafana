import {
  AppendingVector,
  DataFrame,
  Labels,
  CircularVector,
  FieldType,
  parseLabels,
  findUniqueLabels,
} from '@grafana/data';
import { Subject, PartialObserver, Subscription } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { LokiLogsStream } from './types';

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

/**
 * One instance for each unique URL
 */
export class LiveStream {
  private data: BufferedData;

  // WebSocket
  private socket: WebSocketSubject<any>;

  // Processed DataFrame messages.
  private subject = new Subject<DataFrame[]>();

  constructor(public url: string, commonLabels: Labels, capacity: number) {
    const times = new CircularVector<string>({ capacity });
    const lines = new CircularVector<string>({ capacity });
    const labels = new CircularVector<Labels>({ capacity });
    this.data = {
      times,
      lines,
      labels,
      frame: {
        labels: commonLabels,
        fields: [
          { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
          { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
          { name: 'labels', type: FieldType.other, config: {}, values: labels }, // Labels
        ],
        length: 0, // will be updated after values are added
      },
    };

    this.socket = webSocket(url);
    this.socket.subscribe({
      next: (response: any) => {
        appendResponseToBufferedData(response, this.data);
        this.subject.next([this.data.frame]);
      },
      error: (err: any) => {
        this.subject.error(err);
      },
    });
  }

  subscribe(observer: PartialObserver<DataFrame[]>): Subscription {
    // Send the current buffered state
    observer.next([this.data.frame]);

    // Then sign up for future changes
    return this.subject.subscribe(observer);
  }

  hasObservers() {
    return this.subject.observers.length > 0;
  }

  isOpen() {
    return !this.socket.isStopped;
  }

  close() {
    this.socket.complete(); // close the socket
    this.subject.complete();
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
