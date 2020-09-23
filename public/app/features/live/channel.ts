import {
  LiveChannelConfig,
  LiveChannel,
  LiveChannelScope,
  LiveChannelStatus,
  LiveChannelEvent,
  LiveChannelConnectionState,
  LiveChannelPresenseStatus,
} from '@grafana/data';
import Centrifuge, {
  JoinLeaveContext,
  PublicationContext,
  SubscribeErrorContext,
  SubscribeSuccessContext,
  SubscriptionEvents,
  UnsubscribeContext,
} from 'centrifuge/dist/centrifuge.protobuf';
import { Subject, of, merge } from 'rxjs';

/**
 * Internal class that maps Centrifuge support to GrafanaLive
 */
export class CentrifugeLiveChannel<TMessage = any, TPublish = any> implements LiveChannel<TMessage, TPublish> {
  readonly currentStatus: LiveChannelStatus;

  readonly opened = Date.now();
  readonly id: string;
  readonly scope: LiveChannelScope;
  readonly namespace: string;
  readonly path: string;

  readonly stream = new Subject<LiveChannelEvent<TMessage>>();

  /** Static definition of the channel definition.  This may describe the channel usage */
  config?: LiveChannelConfig;
  subscription?: Centrifuge.Subscription;
  shutdownCallback?: () => void;

  constructor(id: string, scope: LiveChannelScope, namespace: string, path: string) {
    this.id = id;
    this.scope = scope;
    this.namespace = namespace;
    this.path = path;
    this.currentStatus = {
      id,
      timestamp: this.opened,
      state: LiveChannelConnectionState.Pending,
    };
  }

  // This should only be called when centrifuge is connected
  initalize(config: LiveChannelConfig): SubscriptionEvents {
    if (this.config) {
      throw new Error('Channel already initalized: ' + this.id);
    }
    this.config = config;
    const prepare = config.processMessage ? config.processMessage : (v: any) => v;

    const events: SubscriptionEvents = {
      // This means a message was recieved from the server
      publish: (ctx: PublicationContext) => {
        this.stream.next({
          message: prepare(ctx.data),
        });

        // Clear any error messages
        if (this.currentStatus.error) {
          this.currentStatus.timestamp = Date.now();
          delete this.currentStatus.error;
          this.sendStatus();
        }
      },
      error: (ctx: SubscribeErrorContext) => {
        this.currentStatus.timestamp = Date.now();
        this.currentStatus.error = ctx.error;
        this.sendStatus();
      },
      subscribe: (ctx: SubscribeSuccessContext) => {
        this.currentStatus.timestamp = Date.now();
        this.currentStatus.state = LiveChannelConnectionState.Connected;
        this.sendStatus();
      },
      unsubscribe: (ctx: UnsubscribeContext) => {
        this.currentStatus.timestamp = Date.now();
        this.currentStatus.state = LiveChannelConnectionState.Disconnected;
        this.sendStatus();
      },
    };

    if (config.hasPresense) {
      events.join = (ctx: JoinLeaveContext) => {
        this.stream.next({
          presense: {
            action: 'join',
            user: ctx.info.user,
          },
        });
      };
      events.leave = (ctx: JoinLeaveContext) => {
        this.stream.next({
          presense: {
            action: 'leave',
            user: ctx.info.user,
          },
        });
      };

      this.getPresense = () => {
        return this.subscription!.presence().then(v => {
          return {
            users: Object.keys(v.presence),
          };
        });
      };
    }
    return events;
  }

  private sendStatus() {
    this.stream.next({ status: { ...this.currentStatus } });
  }

  /**
   * Get the stream of events and
   */
  getStream() {
    const status = { status: { ...this.currentStatus } };
    return merge(of(status), this.stream.asObservable());
  }

  /**
   * This is configured by the server when the config supports presense
   */
  getPresense?: () => Promise<LiveChannelPresenseStatus>;

  /**
   * This is configured by the server when config supports writing
   */
  publish?: (msg: TPublish) => Promise<any>;

  /**
   * This will close and terminate all streams for this channel
   */
  disconnect() {
    this.currentStatus.state = LiveChannelConnectionState.Shutdown;
    this.currentStatus.timestamp = Date.now();

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription.removeAllListeners(); // they keep all listeners attached after unsubscribe
      this.subscription = undefined;
    }

    this.stream.complete();

    this.stream.next({ status: { ...this.currentStatus } });
    this.stream.complete();

    if (this.shutdownCallback) {
      this.shutdownCallback();
    }
  }

  shutdownWithError(err: string) {
    this.currentStatus.error = err;
    this.disconnect();
  }
}

export function getErrorChannel(
  msg: string,
  id: string,
  scope: LiveChannelScope,
  namespace: string,
  path: string
): LiveChannel {
  const errorStatus: LiveChannelStatus = {
    id,
    timestamp: Date.now(),
    state: LiveChannelConnectionState.Invalid,
    error: msg,
  };

  return {
    id,
    opened: Date.now(),
    scope,
    namespace,
    path,

    // return an error
    getStream: () =>
      of({
        type: 'status',
        message: errorStatus,
      }),

    // already disconnected
    disconnect: () => {},
  };
}
