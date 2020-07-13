import { DataFrame, FieldType, parseLabels, KeyValue, CircularDataFrame } from '@grafana/data';
import { Observable, throwError } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { LokiTailResponse } from './types';
import { finalize, map, catchError } from 'rxjs/operators';
import { appendResponseToBufferedData } from './result_transformer';

/**
 * Maps directly to a query in the UI (refId is key)
 */
export interface LokiLiveTarget {
  query: string;
  url: string;
  refId: string;
  size: number;
}

/**
 * Cache of websocket streams that can be returned as observable. In case there already is a stream for particular
 * target it is returned and on subscription returns the latest dataFrame.
 */
export class LiveStreams {
  private streams: KeyValue<Observable<DataFrame[]>> = {};

  getStream(target: LokiLiveTarget): Observable<DataFrame[]> {
    let stream = this.streams[target.url];

    if (stream) {
      return stream;
    }

    const data = new CircularDataFrame({ capacity: target.size });
    data.addField({ name: 'ts', type: FieldType.time, config: { displayName: 'Time' } });
    data.addField({ name: 'tsNs', type: FieldType.time, config: { displayName: 'Time ns' } });
    data.addField({ name: 'line', type: FieldType.string }).labels = parseLabels(target.query);
    data.addField({ name: 'labels', type: FieldType.other }); // The labels for each line
    data.addField({ name: 'id', type: FieldType.string });
    data.meta = { ...data.meta, preferredVisualisationType: 'logs' };

    stream = webSocket(target.url).pipe(
      map((response: LokiTailResponse) => {
        appendResponseToBufferedData(response, data);
        return [data];
      }),
      catchError(err => {
        return throwError(`error: ${err.reason}`);
      }),
      finalize(() => {
        delete this.streams[target.url];
      })
    );
    this.streams[target.url] = stream;

    return stream;
  }
}
