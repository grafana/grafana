import { DataFrame, FieldType, parseLabels, KeyValue, CircularDataFrame } from '@grafana/data';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { LokiResponse } from './types';
import { map } from 'rxjs/operators';
import { appendResponseToBufferedData } from './result_transformer';

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
 * Cache of websocket streams that can be returned as observable. In case there already is a stream for particular
 * target it is returned and on subscription returns the latest dataFrame.
 */
export class LiveStreams {
  private streams: KeyValue<Subject<DataFrame[]>> = {};

  getStream(target: LiveTarget): Observable<DataFrame[]> {
    let stream = this.streams[target.url];
    if (!stream) {
      const data = new CircularDataFrame({ capacity: target.size });
      data.labels = parseLabels(target.query);
      data.addField({ name: 'ts', type: FieldType.time, config: { title: 'Time' } });
      data.addField({ name: 'line', type: FieldType.string });
      data.addField({ name: 'labels', type: FieldType.other });

      const subject = new BehaviorSubject<DataFrame[]>([]);
      webSocket(target.url)
        .pipe(
          map((response: LokiResponse) => {
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
