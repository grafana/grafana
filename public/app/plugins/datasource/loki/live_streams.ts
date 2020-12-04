import { DataFrame, FieldType, parseLabels, KeyValue, CircularDataFrame } from '@grafana/data';
import { Observable, throwError, timer } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { LokiTailResponse } from './types';
import { finalize, map, retryWhen, mergeMap } from 'rxjs/operators';
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

  getStream(target: LokiLiveTarget, retryInterval = 5000): Observable<DataFrame[]> {
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
      retryWhen((attempts: Observable<any>) =>
        attempts.pipe(
          mergeMap((error, i) => {
            const retryAttempt = i + 1;
            // Code 1006 is used to indicate that a connection was closed abnormally.
            // Added hard limit of 30 on number of retries.
            // If connection was closed abnormally, and we wish to retry, otherwise throw error.
            if (error.code === 1006 && retryAttempt < 30) {
              if (retryAttempt > 10) {
                // If more than 10 times retried, consol.warn, but keep reconnecting
                console.warn(
                  `Websocket connection is being disrupted. We keep reconnecting but consider starting new live tailing again. Error: ${error.reason}`
                );
              }
              // Retry every 5s
              return timer(retryInterval);
            }
            return throwError(`error: ${error.reason}`);
          })
        )
      ),
      finalize(() => {
        delete this.streams[target.url];
      })
    );
    this.streams[target.url] = stream;

    return stream;
  }
}
