import {
  LiveChannelEvent,
  LiveChannelConnectionState,
  DataQueryResponse,
  DataFrameJSON,
  LoadingState,
  StreamingDataFrame,
  dataFrameToJSON,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  DataFrame,
} from '@grafana/data';
import { LiveDataStreamOptions, toDataQueryError } from '@grafana/runtime';

import { Observable, ReplaySubject, Unsubscribable } from 'rxjs';
import { CentrifugeLiveChannel } from './channel';
import { perf } from './perf';

/**
 * Internal class that maps Centrifuge support to GrafanaLive
 */
export class ChannelDataStream {
  private stream = new ReplaySubject<DataQueryResponse>(1); // replay the last value
  private subscription: Unsubscribable;
  private key: string;
  private state: LoadingState;
  private data?: StreamingDataFrame;
  private filtered?: DataFrame;
  private filter: boolean;
  private last = -1;

  constructor(channel: CentrifugeLiveChannel<DataFrameJSON>, private options: LiveDataStreamOptions) {
    this.key = options.key ?? `xstr/${streamCounter++}`;
    this.subscription = channel.getStream().subscribe(this.observer);
    this.state = LoadingState.Loading;

    if (options.frame) {
      const msg = dataFrameToJSON(options.frame);
      this.data = new StreamingDataFrame(msg, options.buffer);
      this.filtered = this.data;
      this.state = LoadingState.Streaming;
    }
    this.filter = Boolean(options.filter?.fields?.length);
  }

  get done() {
    return this.stream.closed;
  }

  finish = () => {
    this.subscription.unsubscribe(); // close after error
    this.stream.complete();
    this.stream.unsubscribe();

    console.log('FINISH stream', this.options.addr);
  };

  process = (msg: DataFrameJSON) => {
    if (!this.data) {
      this.data = new StreamingDataFrame(msg, this.options.buffer);
      this.filtered = this.data;
    } else {
      this.data.push(msg);
    }
    this.state = LoadingState.Streaming;

    // Filter out fields
    if (this.filter && msg.schema) {
      const { fields } = this.options.filter!;
      if (fields?.length) {
        this.filtered = {
          ...this.data,
          fields: this.data.fields.filter((f) => fields.includes(f.name)),
        };
      }
    }

    const elapsed = perf.last - this.last;
    if (elapsed > 1000 || perf.ok) {
      this.filtered!.length = this.data.length; // make sure they stay up-to-date
      this.stream.next({ state: this.state, data: [this.filtered], key: this.key });
      this.last = perf.last;
    }
  };

  observer = {
    error: (err: any) => {
      console.log('LiveQuery [error]', { err }, this.options.addr);
      this.state = LoadingState.Error;
      this.stream.next({ state: this.state, data: [this.filtered], key: this.key, error: toDataQueryError(err) });
      this.subscription.unsubscribe(); // close after error
      this.stream.complete();
    },
    complete: () => {
      console.log('LiveQuery [complete]', this.options.addr);
      if (this.state !== LoadingState.Error) {
        this.state = LoadingState.Done;
      }
      // or track errors? subscriber.next({ state, data: [data], key });
      this.finish();
    },
    next: (evt: LiveChannelEvent<DataFrameJSON>) => {
      if (isLiveChannelMessageEvent(evt)) {
        this.process(evt.message);
        return;
      }
      if (isLiveChannelStatusEvent(evt)) {
        if (evt.error) {
          let error = toDataQueryError(evt.error);
          error.message = `Streaming channel error: ${error.message}`;
          this.state = LoadingState.Error;
          this.stream.next({ state: this.state, data: [this.filtered], key: this.key, error });
          return;
        } else if (
          evt.state === LiveChannelConnectionState.Connected ||
          evt.state === LiveChannelConnectionState.Pending
        ) {
          if (evt.message) {
            this.process(evt.message);
          }
        }
        console.log('ignore state', evt);
      }
    },
  };

  disconnectIfNoListeners = () => {
    const count = this.stream.observers.length;
    if (count === 0) {
      console.log('timeout no listeners', this.options.addr);
      this.finish();
    }
  };

  getObservable(frame?: DataFrameJSON) {
    console.log('subscribe', this.stream.observers.length);
    return this.stream.asObservable();

    // return new Observable<DataQueryResponse>((subscriber) => {
    //   const sub = this.stream.subscribe(subscriber);
    //   console.log('subscribe', this.stream.observers.length);
    //   return () => {
    //     debugger;
    //     sub.unsubscribe();
    //     const count = this.stream.observers.length;
    //     console.log('unsubscribe', count);

    //     // Wait 1/4 second to fully disconnect
    //     if (count === 0) {
    //       setTimeout(this.disconnectIfNoListeners, 250);
    //     }
    //   };
    // });
  }
}

// return new Observable<DataQueryResponse>((subscriber) => {
//   let data: StreamingDataFrame | undefined = undefined;
//   let filtered: DataFrame | undefined = undefined;
//   let state = LoadingState.Loading;
//   let { key } = options;
//   let last = perf.last;
//   if (options.frame) {
//     const msg = dataFrameToJSON(options.frame);
//     data = new StreamingDataFrame(msg, options.buffer);
//     state = LoadingState.Streaming;
//   }
//   if (!key) {
//     key = `xstr/${streamCounter++}`;
//   }

//   const process = (msg: DataFrameJSON) => {
//     if (!data) {
//       data = new StreamingDataFrame(msg, options.buffer);
//     } else {
//       data.push(msg);
//     }
//     state = LoadingState.Streaming;

//     // Filter out fields
//     if (!filtered || msg.schema) {
//       filtered = data;
//       if (options.filter) {
//         const { fields } = options.filter;
//         if (fields?.length) {
//           filtered = {
//             ...data,
//             fields: data.fields.filter((f) => fields.includes(f.name)),
//           };
//         }
//       }
//     }

//     const elapsed = perf.last - last;
//     if (elapsed > 1000 || perf.ok) {
//       filtered.length = data.length; // make sure they stay up-to-date
//       subscriber.next({ state, data: [filtered], key });
//       last = perf.last;
//     }
//   };

//   const sub = this.getChannel<DataFrameJSON>(options.addr)
//     .getStream()
//     .subscribe({
//       error: (err: any) => {
//         console.log('LiveQuery [error]', { err }, options.addr);
//         state = LoadingState.Error;
//         subscriber.next({ state, data: [data], key, error: toDataQueryError(err) });
//         sub.unsubscribe(); // close after error
//       },
//       complete: () => {
//         console.log('LiveQuery [complete]', options.addr);
//         if (state !== LoadingState.Error) {
//           state = LoadingState.Done;
//         }
//         // or track errors? subscriber.next({ state, data: [data], key });
//         subscriber.complete();
//         sub.unsubscribe();
//       },
//       next: (evt: LiveChannelEvent<DataFrameJSON>) => {
//         if (isLiveChannelMessageEvent(evt)) {
//           process(evt.message);
//           return;
//         }
//         if (isLiveChannelStatusEvent(evt)) {
//           if (evt.error) {
//             let error = toDataQueryError(evt.error);
//             error.message = `Streaming channel error: ${error.message}`;
//             state = LoadingState.Error;
//             subscriber.next({ state, data: [data], key, error });
//             return;
//           } else if (
//             evt.state === LiveChannelConnectionState.Connected ||
//             evt.state === LiveChannelConnectionState.Pending
//           ) {
//             if (evt.message) {
//               process(evt.message);
//             }
//           }
//           console.log('ignore state', evt);
//         }
//       },
//     });

//   return () => {
//     sub.unsubscribe();
//   };
// });

// incremet the stream ids
let streamCounter = 10;
