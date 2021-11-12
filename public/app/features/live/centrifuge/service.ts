import Centrifuge from 'centrifuge/dist/centrifuge';
import { LiveDataStreamOptions } from '@grafana/runtime';
import { toDataQueryError } from '@grafana/runtime/src/utils/toDataQueryError';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  DataFrame,
  DataFrameJSON,
  dataFrameToJSON,
  DataQueryResponse,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  LiveChannelAddress,
  LiveChannelConnectionState,
  LiveChannelEvent,
  LiveChannelPresenceStatus,
  LoadingState,
  StreamingDataFrame,
  toDataFrameDTO,
} from '@grafana/data';
import { CentrifugeLiveChannel } from './channel';

export type CentrifugeSrvDeps = {
  appUrl: string;
  orgId: number;
  orgRole: string;
  sessionId: string;
  liveEnabled: boolean;
  dataStreamSubscriberReadiness: Observable<boolean>;
};

export interface CentrifugeSrv {
  /**
   * Listen for changes to the connection state
   */
  getConnectionState(): Observable<boolean>;

  /**
   * Watch for messages in a channel
   */
  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>>;

  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream(options: LiveDataStreamOptions): Observable<DataQueryResponse>;

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  getPresence(address: LiveChannelAddress): Promise<LiveChannelPresenceStatus>;
}

export class CentrifugeService implements CentrifugeSrv {
  readonly open = new Map<string, CentrifugeLiveChannel>();
  readonly centrifuge: Centrifuge;
  readonly connectionState: BehaviorSubject<boolean>;
  readonly connectionBlocker: Promise<void>;
  private dataStreamSubscriberReady = true;

  constructor(private deps: CentrifugeSrvDeps) {
    deps.dataStreamSubscriberReadiness.subscribe((next) => (this.dataStreamSubscriberReady = next));
    const liveUrl = `${deps.appUrl.replace(/^http/, 'ws')}/api/live/ws`;
    this.centrifuge = new Centrifuge(liveUrl, {});
    this.centrifuge.setConnectData({
      sessionId: deps.sessionId,
      orgId: deps.orgId,
    });
    // orgRole is set when logged in *or* anonomus users can use grafana
    if (deps.liveEnabled && deps.orgRole !== '') {
      this.centrifuge.connect(); // do connection
    }
    this.connectionState = new BehaviorSubject<boolean>(this.centrifuge.isConnected());
    this.connectionBlocker = new Promise<void>((resolve) => {
      if (this.centrifuge.isConnected()) {
        return resolve();
      }
      const connectListener = () => {
        resolve();
        this.centrifuge.removeListener('connect', connectListener);
      };
      this.centrifuge.addListener('connect', connectListener);
    });

    // Register global listeners
    this.centrifuge.on('connect', this.onConnect);
    this.centrifuge.on('disconnect', this.onDisconnect);
    this.centrifuge.on('publish', this.onServerSideMessage);
  }

  //----------------------------------------------------------
  // Internal functions
  //----------------------------------------------------------

  private onConnect = (context: any) => {
    this.connectionState.next(true);
  };

  private onDisconnect = (context: any) => {
    this.connectionState.next(false);
  };

  private onServerSideMessage = (context: any) => {
    console.log('Publication from server-side channel', context);
  };

  /**
   * Get a channel.  If the scope, namespace, or path is invalid, a shutdown
   * channel will be returned with an error state indicated in its status
   */
  private getChannel<TMessage>(addr: LiveChannelAddress): CentrifugeLiveChannel<TMessage> {
    const id = `${this.deps.orgId}/${addr.scope}/${addr.namespace}/${addr.path}`;
    let channel = this.open.get(id);
    if (channel != null) {
      return channel;
    }

    channel = new CentrifugeLiveChannel(id, addr);
    if (channel.currentStatus.state === LiveChannelConnectionState.Invalid) {
      return channel;
    }
    channel.shutdownCallback = () => {
      this.open.delete(id); // remove it from the list of open channels
    };
    this.open.set(id, channel);

    // Initialize the channel in the background
    this.initChannel(channel).catch((err) => {
      if (channel) {
        channel.currentStatus.state = LiveChannelConnectionState.Invalid;
        channel.shutdownWithError(err);
      }
      this.open.delete(id);
    });

    // return the not-yet initalized channel
    return channel;
  }

  private async initChannel(channel: CentrifugeLiveChannel): Promise<void> {
    const events = channel.initalize();
    if (!this.centrifuge.isConnected()) {
      await this.connectionBlocker;
    }
    channel.subscription = this.centrifuge.subscribe(channel.id, events);
    return;
  }

  //----------------------------------------------------------
  // Exported functions
  //----------------------------------------------------------

  /**
   * Listen for changes to the connection state
   */
  getConnectionState() {
    return this.connectionState.asObservable();
  }

  /**
   * Watch for messages in a channel
   */
  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>> {
    return this.getChannel<T>(address).getStream();
  }

  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream(options: LiveDataStreamOptions): Observable<DataQueryResponse> {
    return new Observable<DataQueryResponse>((subscriber) => {
      const channel = this.getChannel(options.addr);
      const key = options.key ?? `xstr/${streamCounter++}`;
      let data: StreamingDataFrame | undefined = undefined;
      let filtered: DataFrame | undefined = undefined;
      let state = LoadingState.Streaming;
      let lastWidth = -1;

      const process = (msg: DataFrameJSON) => {
        if (!data) {
          data = new StreamingDataFrame(msg, options.buffer);
        } else {
          data.push(msg);
        }
        state = LoadingState.Streaming;
        const sameWidth = lastWidth === data.fields.length;
        lastWidth = data.fields.length;

        // Filter out fields
        if (!filtered || msg.schema || !sameWidth) {
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

        if (this.dataStreamSubscriberReady) {
          filtered.length = data.length; // make sure they stay up-to-date
          subscriber.next({
            state,
            data: [
              // workaround for serializing issues when sending DataFrame from web worker to the main thread
              // DataFrame is making use of ArrayVectors which are es6 classes and thus not cloneable out of the box
              // `toDataFrameDTO` converts ArrayVectors into native arrays.
              toDataFrameDTO(filtered),
            ],
            key,
          });
        }
      };

      if (options.frame) {
        process(dataFrameToJSON(options.frame));
      } else if (channel.lastMessageWithSchema) {
        process(channel.lastMessageWithSchema);
      }

      const sub = channel.getStream().subscribe({
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

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  getPresence(address: LiveChannelAddress): Promise<LiveChannelPresenceStatus> {
    return this.getChannel(address).getPresence();
  }
}

// This is used to give a unique key for each stream.  The actual value does not matter
let streamCounter = 0;
