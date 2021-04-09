import {
  DataFrame,
  DataFrameJSON,
  dataFrameToJSON,
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
import { toDataQueryError } from './queryResponse';
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
  frame?: DataFrame; // initial results
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
    return of({
      error: toDataQueryError(`invalid channel address: ${JSON.stringify(options.addr)}`),
      state: LoadingState.Error,
      data: options.frame ? [options.frame] : [],
    });
  }

  const live = getGrafanaLiveSrv();
  if (!live) {
    return of({ error: toDataQueryError('grafana live is not initalized'), data: [] });
  }

  return new Observable<DataQueryResponse>((subscriber) => {
    let data: StreamingDataFrame | undefined = undefined;
    let filtered: DataFrame | undefined = undefined;
    let state = LoadingState.Loading;
    let { key } = options;
    let last = perf.last;
    if (options.frame) {
      const msg = dataFrameToJSON(options.frame);
      data = new StreamingDataFrame(msg, options.buffer);
      state = LoadingState.Streaming;
    }
    if (!key) {
      key = `xstr/${streamCounter++}`;
    }

    const process = (msg: DataFrameJSON) => {
      if (!data) {
        data = new StreamingDataFrame(msg, options.buffer);
      } else {
        data.push(msg);
      }
      state = LoadingState.Streaming;

      // Filter out fields
      if (!filtered || msg.schema) {
        filtered = data;
        if (options.filter) {
          const { fields } = options.filter;
          if (fields?.length) {
            filtered = {
              ...data,
              fields: data.fields.filter((f) => fields.includes(f.name)),
            };
          }
        }
      }

      const elapsed = perf.last - last;
      if (elapsed > 1000 || perf.ok) {
        filtered.length = data.length; // make sure they stay up-to-date
        subscriber.next({ state, data: [filtered], key });
        last = perf.last;
      }
    };

    const sub = live
      .getChannel<DataFrameJSON>(options.addr)
      .getStream()
      .subscribe({
        error: (err: any) => {
          console.log('LiveQuery [error]', { err }, options.addr);
          state = LoadingState.Error;
          subscriber.next({ state, data: [data], key, error: toDataQueryError(err) });
          sub.unsubscribe(); // close after error
        },
        complete: () => {
          console.log('LiveQuery [complete]', options.addr);
          if (state !== LoadingState.Error) {
            state = LoadingState.Done;
          }
          // or track errors? subscriber.next({ state, data: [data], key });
          subscriber.complete();
          sub.unsubscribe();
        },
        next: (evt: LiveChannelEvent) => {
          if (isLiveChannelMessageEvent(evt)) {
            process(evt.message);
            return;
          }
          if (isLiveChannelStatusEvent(evt)) {
            if (evt.error) {
              let error = toDataQueryError(evt.error);
              error.message = `Streaming channel error: ${error.message}`;
              state = LoadingState.Error;
              subscriber.next({ state, data: [data], key, error });
              return;
            } else if (
              evt.state === LiveChannelConnectionState.Connected ||
              evt.state === LiveChannelConnectionState.Pending
            ) {
              if (evt.message) {
                process(evt.message);
              }
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

// incremet the stream ids
let streamCounter = 10;
