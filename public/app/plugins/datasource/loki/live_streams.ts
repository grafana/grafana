import { DataFrame, FieldType, parseLabels, KeyValue, CircularDataFrame } from '@grafana/data';
import { Observable } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { LokiLegacyStreamResponse, LokiTailResponse } from './types';
import { finalize, map } from 'rxjs/operators';
import { appendLegacyResponseToBufferedData, appendResponseToBufferedData } from './result_transformer';

/**
 * Maps directly to a query in the UI (refId is key)
 */
export interface LegacyTarget {
  query: string;
  regexp: string;
  url: string;
  refId: string;
  size: number;
}

export interface LiveTarget {
  query: string;
  delay_for?: string;
  limit?: string;
  start?: string;
}

/**
 * Cache of websocket streams that can be returned as observable. In case there already is a stream for particular
 * target it is returned and on subscription returns the latest dataFrame.
 */
export class LiveStreams {
  private streams: KeyValue<Observable<DataFrame[]>> = {};

  getLegacyStream(target: LegacyTarget): Observable<DataFrame[]> {
    let stream = this.streams[target.url];

    if (stream) {
      return stream;
    }

    const data = new CircularDataFrame({ capacity: target.size });
    data.addField({ name: 'ts', type: FieldType.time, config: { title: 'Time' } });
    data.addField({ name: 'line', type: FieldType.string }).labels = parseLabels(target.query);
    data.addField({ name: 'labels', type: FieldType.other }); // The labels for each line
    data.addField({ name: 'id', type: FieldType.string });

    stream = webSocket(target.url).pipe(
      finalize(() => {
        delete this.streams[target.url];
      }),

      map((response: LokiLegacyStreamResponse) => {
        appendLegacyResponseToBufferedData(response, data);
        return [data];
      })
    );
    this.streams[target.url] = stream;

    return stream;
  }

  getStream(target: LegacyTarget): Observable<DataFrame[]> {
    let stream = this.streams[target.url];

    if (stream) {
      return stream;
    }

    const data = new CircularDataFrame({ capacity: target.size });
    data.addField({ name: 'ts', type: FieldType.time, config: { title: 'Time' } });
    data.addField({ name: 'tsNs', type: FieldType.time, config: { title: 'Time ns' } });
    data.addField({ name: 'line', type: FieldType.string }).labels = parseLabels(target.query);
    data.addField({ name: 'labels', type: FieldType.other }); // The labels for each line
    data.addField({ name: 'id', type: FieldType.string });

    stream = webSocket(target.url).pipe(
      finalize(() => {
        delete this.streams[target.url];
      }),

      map((response: LokiTailResponse) => {
        appendResponseToBufferedData(response, data);
        return [data];
      })
    );
    this.streams[target.url] = stream;

    return stream;
  }
}
