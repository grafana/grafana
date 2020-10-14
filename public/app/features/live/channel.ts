import {
  LiveChannelConfig,
  LiveChannel,
  LiveChannelStatusEvent,
  LiveChannelEvent,
  LiveChannelEventType,
  LiveChannelConnectionState,
  LiveChannelPresenceStatus,
  LiveChannelAddress,
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
  readonly currentStatus: LiveChannelStatusEvent;

  readonly opened = Date.now();
  readonly id: string;
  readonly addr: LiveChannelAddress;

  readonly stream = new Subject<LiveChannelEvent<TMessage>>();

  /** Static definition of the channel definition.  This may describe the channel usage */
  config?: LiveChannelConfig;
  subscription?: Centrifuge.Subscription;
  shutdownCallback?: () => void;

  constructor(id: string, addr: LiveChannelAddress) {
    this.id = id;
    this.addr = addr;
    this.currentStatus = {
      type: LiveChannelEventType.Status,
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
      // This means a message was received from the server
      publish: (ctx: PublicationContext) => {
        try {
          const message = prepare(ctx.data);
          if (message) {
            this.stream.next({
              type: LiveChannelEventType.Message,
              message,
            });
          }

          // Clear any error messages
          if (this.currentStatus.error) {
            this.currentStatus.timestamp = Date.now();
            delete this.currentStatus.error;
            this.sendStatus();
          }
        } catch (err) {
          console.log('publish error', config.path, err);
          this.currentStatus.error = err;
          this.currentStatus.timestamp = Date.now();
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
        delete this.currentStatus.error;
        this.sendStatus();
      },
      unsubscribe: (ctx: UnsubscribeContext) => {
        this.currentStatus.timestamp = Date.now();
        this.currentStatus.state = LiveChannelConnectionState.Disconnected;
        this.sendStatus();
      },
    };

    if (config.hasPresence) {
      events.join = (ctx: JoinLeaveContext) => {
        this.stream.next({ type: LiveChannelEventType.Join, user: ctx.info.user });
      };
      events.leave = (ctx: JoinLeaveContext) => {
        this.stream.next({ type: LiveChannelEventType.Leave, user: ctx.info.user });
      };

      this.getPresence = () => {
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
    this.stream.next({ ...this.currentStatus });
  }

  /**
   * Get the stream of events and
   */
  getStream() {
    return merge(of({ ...this.currentStatus }), this.stream.asObservable());
  }

  /**
   * This is configured by the server when the config supports presence
   */
  getPresence?: () => Promise<LiveChannelPresenceStatus>;

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

    this.stream.next({ ...this.currentStatus });
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

export function getErrorChannel(msg: string, id: string, addr: LiveChannelAddress): LiveChannel {
  return {
    id,
    opened: Date.now(),
    addr,

    // return an error
    getStream: () =>
      of({
        type: LiveChannelEventType.Status,
        id,
        timestamp: Date.now(),
        state: LiveChannelConnectionState.Invalid,
        error: msg,
      }),

    // already disconnected
    disconnect: () => {},
  };
}
