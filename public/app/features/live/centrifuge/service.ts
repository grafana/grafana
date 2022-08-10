import Centrifuge from 'centrifuge/dist/centrifuge';
import { BehaviorSubject, Observable, share, startWith } from 'rxjs';

import {
  DataQueryError,
  DataQueryResponse,
  LiveChannelAddress,
  LiveChannelConnectionState,
  LiveChannelId,
  toLiveChannelId,
} from '@grafana/data';
import { FetchResponse } from '@grafana/runtime/src/services/backendSrv';
import {
  GrafanaLiveSrv,
  LiveDataStreamOptions,
  LiveQueryDataOptions,
  StreamingFrameAction,
  StreamingFrameOptions,
} from '@grafana/runtime/src/services/live';
import { BackendDataSourceResponse } from '@grafana/runtime/src/utils/queryResponse';
import { loadUrlToken } from 'app/core/utils/urlToken';

import { StreamingResponseData } from '../data/utils';

import { LiveDataStream } from './LiveDataStream';
import { CentrifugeLiveChannel } from './channel';

export type CentrifugeSrvDeps = {
  appUrl: string;
  orgId: number;
  orgRole: string;
  sessionId: string;
  liveEnabled: boolean;
  dataStreamSubscriberReadiness: Observable<boolean>;
};

export type StreamingDataQueryResponse = Omit<DataQueryResponse, 'data'> & { data: [StreamingResponseData] };

export type CentrifugeSrv = Omit<GrafanaLiveSrv, 'publish' | 'getDataStream' | 'getQueryData'> & {
  getDataStream: (options: LiveDataStreamOptions) => Observable<StreamingDataQueryResponse>;
  getQueryData: (
    options: LiveQueryDataOptions
  ) => Promise<
    | { data: BackendDataSourceResponse | undefined }
    | FetchResponse<BackendDataSourceResponse | undefined>
    | DataQueryError
  >;
};

export type DataStreamSubscriptionKey = string;

const defaultStreamingFrameOptions: Readonly<StreamingFrameOptions> = {
  maxLength: 100,
  maxDelta: Infinity,
  action: StreamingFrameAction.Append,
};

const dataStreamShutdownDelayInMs = 5000;

export class CentrifugeService implements CentrifugeSrv {
  readonly open = new Map<string, CentrifugeLiveChannel>();
  private readonly liveDataStreamByChannelId: Record<LiveChannelId, LiveDataStream> = {};
  readonly centrifuge: Centrifuge;
  readonly connectionState: BehaviorSubject<boolean>;
  readonly connectionBlocker: Promise<void>;
  private readonly dataStreamSubscriberReadiness: Observable<boolean>;

  constructor(private deps: CentrifugeSrvDeps) {
    this.dataStreamSubscriberReadiness = deps.dataStreamSubscriberReadiness.pipe(share(), startWith(true));

    let liveUrl = `${deps.appUrl.replace(/^http/, 'ws')}/api/live/ws`;

    const token = loadUrlToken();
    if (token !== null && token !== '') {
      liveUrl += '?auth_token=' + token;
    }

    this.centrifuge = new Centrifuge(liveUrl, {
      timeout: 30000,
    });
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

    // return the not-yet initialized channel
    return channel;
  }

  private async initChannel(channel: CentrifugeLiveChannel): Promise<void> {
    const events = channel.initalize();
    if (!this.centrifuge.isConnected()) {
      await this.connectionBlocker;
    }
    channel.subscription = this.centrifuge.subscribe(channel.id, events, { data: channel.addr.data });
    return;
  }

  //----------------------------------------------------------
  // Exported functions
  //----------------------------------------------------------

  /**
   * Listen for changes to the connection state
   */
  getConnectionState = () => {
    return this.connectionState.asObservable();
  };

  /**
   * Watch for messages in a channel
   */
  getStream: CentrifugeSrv['getStream'] = <T>(address: LiveChannelAddress) => {
    return this.getChannel<T>(address).getStream();
  };

  private createSubscriptionKey = (options: LiveDataStreamOptions): DataStreamSubscriptionKey =>
    options.key ?? `xstr/${streamCounter++}`;

  private getLiveDataStream = (options: LiveDataStreamOptions): LiveDataStream => {
    const channelId = toLiveChannelId(options.addr);
    const existingStream = this.liveDataStreamByChannelId[channelId];

    if (existingStream) {
      return existingStream;
    }

    const channel = this.getChannel(options.addr);
    this.liveDataStreamByChannelId[channelId] = new LiveDataStream({
      channelId,
      onShutdown: () => {
        delete this.liveDataStreamByChannelId[channelId];
      },
      liveEventsObservable: channel.getStream(),
      subscriberReadiness: this.dataStreamSubscriberReadiness,
      defaultStreamingFrameOptions,
      shutdownDelayInMs: dataStreamShutdownDelayInMs,
    });
    return this.liveDataStreamByChannelId[channelId];
  };
  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream: CentrifugeSrv['getDataStream'] = (options) => {
    const subscriptionKey = this.createSubscriptionKey(options);

    const stream = this.getLiveDataStream(options);
    return stream.get(options, subscriptionKey);
  };

  /**
   * Executes a query over the live websocket. Query response can contain live channels we can subscribe to for further updates
   *
   * Since the initial request and subscription are on the same socket, this will support HA setups
   */
  getQueryData: CentrifugeSrv['getQueryData'] = async (options) => {
    if (!this.centrifuge.isConnected()) {
      await this.connectionBlocker;
    }
    return this.centrifuge.namedRPC('grafana.query', options.body);
  };

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  getPresence: CentrifugeSrv['getPresence'] = (address) => {
    return this.getChannel(address).getPresence();
  };
}

// This is used to give a unique key for each stream.  The actual value does not matter
let streamCounter = 0;
