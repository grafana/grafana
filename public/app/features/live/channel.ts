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
} from 'centrifuge/dist/centrifuge';

import { Subject, of, Observable } from 'rxjs';

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

    const events: SubscriptionEvents = {
      // Called when a message is recieved from the socket
      publish: (ctx: PublicationContext) => {
        try {
          if (ctx.data) {
            this.stream.next({
              type: LiveChannelEventType.Message,
              message: ctx.data,
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
        this.sendStatus(ctx.data);
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
        return this.subscription!.presence().then((v) => {
          return {
            users: Object.keys(v.presence),
          };
        });
      };
    }
    return events;
  }

  private sendStatus(message?: any) {
    const copy = { ...this.currentStatus };
    if (message) {
      copy.message = message;
    }
    this.stream.next(copy);
  }

  /**
   * Get the stream of events and
   */
  getStream() {
    return new Observable((subscriber) => {
      subscriber.next({ ...this.currentStatus });
      const sub = this.stream.subscribe(subscriber);
      return () => {
        sub.unsubscribe();
        const count = this.stream.observers.length;
        console.log('unsubscribe stream', this.addr, count);

        // Fully disconnect when no more listeners
        if (count === 0) {
          this.disconnect();
        }
      };
    }) as Observable<LiveChannelEvent<TMessage>>;
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
    this.sendStatus();
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
