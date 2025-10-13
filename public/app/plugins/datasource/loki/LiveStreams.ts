import { Observable, throwError, timer } from 'rxjs';
import { finalize, map, retryWhen, mergeMap } from 'rxjs/operators';
import { webSocket } from 'rxjs/webSocket';

import { DataFrame, FieldType, KeyValue, CircularDataFrame } from '@grafana/data';

import { appendResponseToBufferedData } from './liveStreamsResultTransformer';
import { LokiTailResponse } from './types';

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
    data.addField({ name: 'Time', type: FieldType.time, config: {} });
    data.addField({ name: 'Line', type: FieldType.string });
    data.addField({ name: 'id', type: FieldType.string });
    data.meta = { ...data.meta, preferredVisualisationType: 'logs' };
    data.refId = target.refId;

    stream = webSocket<LokiTailResponse>(target.url).pipe(
      map((response: LokiTailResponse) => {
        appendResponseToBufferedData(response, data);
        return [data];
      }),
      retryWhen((attempts) =>
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
            return throwError(error);
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
