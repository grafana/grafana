import {
  DataFrame,
  DataFrameJSON,
  DataQueryResponse,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  isValidLiveChannelAddress,
  LiveChannelAddress,
  LiveChannelConnectionState,
  LiveChannelEvent,
  LoadingState,
  StreamingDataFrame,
  StreamingFrameOptions,
} from '@grafana/data';
import { getGrafanaLiveSrv } from '../services/live';

import { Observable, of } from 'rxjs';
import { toDataQueryError } from '../utils/queryResponse';
import { perf } from './perf';

export interface LiveDataFilter {
  fields?: string[];
}

/**
 * @alpha
 */
export interface LiveDataStreamOptions {
  key?: string;
  addr: LiveChannelAddress;
  buffer?: StreamingFrameOptions;
  filter?: LiveDataFilter;
}

/**
 * Continue executing requests as long as `getNextQuery` returns a query
 *
 * @alpha
 */
export function getLiveDataStream(options: LiveDataStreamOptions): Observable<DataQueryResponse> {
  if (!isValidLiveChannelAddress(options.addr)) {
    return of({ error: toDataQueryError('invalid address'), data: [] });
  }
  const live = getGrafanaLiveSrv();
  if (!live) {
    return of({ error: toDataQueryError('grafana live is not initalized'), data: [] });
  }

  return new Observable<DataQueryResponse>((subscriber) => {
    let data: StreamingDataFrame | undefined = undefined;
    let state = LoadingState.Loading;
    const { key, filter } = options;
    let last = perf.last;

    const process = (msg: DataFrameJSON) => {
      if (!data) {
        data = new StreamingDataFrame(msg, options.buffer);
      } else {
        data.push(msg);
      }
      state = LoadingState.Streaming;

      // TODO?  this *coud* happen only when the schema changes
      let filtered = data as DataFrame;
      if (filter?.fields && filter.fields.length) {
        filtered = {
          ...data,
          fields: data.fields.filter((f) => filter.fields!.includes(f.name)),
        };
      }

      const elapsed = perf.last - last;
      if (elapsed > 1000 || perf.ok) {
        subscriber.next({ state, data: [filtered], key });
        last = perf.last;
      }
    };

    const sub = live
      .getChannel<DataFrameJSON>(options.addr)
      .getStream()
      .subscribe({
        error: (err: any) => {
          state = LoadingState.Error;
          subscriber.next({ state, data: [data], key });
          sub.unsubscribe(); // close after error
        },
        complete: () => {
          if (state !== LoadingState.Error) {
            state = LoadingState.Done;
          }
          subscriber.next({ state, data: [data], key });
          subscriber.complete();
          sub.unsubscribe();
        },
        next: (evt: LiveChannelEvent) => {
          if (isLiveChannelMessageEvent(evt)) {
            process(evt.message);
            return;
          }
          if (isLiveChannelStatusEvent(evt)) {
            if (
              evt.state === LiveChannelConnectionState.Connected ||
              evt.state === LiveChannelConnectionState.Pending
            ) {
              if (evt.message) {
                process(evt.message);
              }
              return;
            }
            console.log('ignore state', evt);
          }
        },
      });

    return () => {
      sub.unsubscribe();
    };
  });
}
