import {
  LiveChannelConfig,
  LiveChannel,
  LiveChannelScope,
  LiveChannelStatus,
  LiveChannelPresense,
} from '@grafana/data';
import Centrifuge, {
  JoinLeaveContext,
  PublicationContext,
  SubscribeErrorContext,
  SubscribeSuccessContext,
  SubscriptionEvents,
  UnsubscribeContext,
} from 'centrifuge/dist/centrifuge.protobuf';
import { Observable, BehaviorSubject, Subject, throwError, of } from 'rxjs';

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

  readonly stream = new Subject<TMessage>();
  readonly status: BehaviorSubject<LiveChannelStatus>;

  // When presense is enabled (rarely), this will be initalized
  private presense?: Subject<LiveChannelPresense>;

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
      timestamp: Date.now(),
      connected: false,
    };
    this.status = new BehaviorSubject<LiveChannelStatus>(this.currentStatus);
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
        this.stream.next(prepare(ctx.data));

        // Clear any error messages
        if (this.currentStatus.error) {
          this.currentStatus.timestamp = Date.now();
          delete this.currentStatus.error;
          this.status.next({ ...this.currentStatus });
        }
      },
      error: (ctx: SubscribeErrorContext) => {
        this.currentStatus.timestamp = Date.now();
        this.currentStatus.error = ctx.error;
        this.status.next({ ...this.currentStatus });
      },
      subscribe: (ctx: SubscribeSuccessContext) => {
        this.currentStatus.timestamp = Date.now();
        this.currentStatus.connected = true;
        this.status.next({ ...this.currentStatus });
      },
      unsubscribe: (ctx: UnsubscribeContext) => {
        this.currentStatus.timestamp = Date.now();
        this.currentStatus.connected = false;
        this.status.next({ ...this.currentStatus });
      },
    };

    if (config.hasPresense) {
      this.presense = new Subject<LiveChannelPresense>();
      events.join = (ctx: JoinLeaveContext) => {
        this.presense!.next({
          action: 'join',
          user: ctx.info.user,
        });
      };
      events.leave = (ctx: JoinLeaveContext) => {
        this.presense!.next({
          action: 'leave',
          user: ctx.info.user,
        });
      };

      this.getPresense = () => this.presense!.asObservable();
    }

    return events;
  }

  /**
   * Get the channel status
   */
  getStatus() {
    return this.status.asObservable();
  }

  /**
   * Get the stream of events and
   */
  getStream() {
    return this.stream.asObservable();
  }

  /**
   * This is configured if presense is supported
   */
  getPresense?: () => Observable<LiveChannelPresense>;

  /**
   * This is configured by the server when config supports writing
   */
  publish?: (msg: TPublish) => Promise<any>;

  /**
   * This will close and terminate all streams for this channel
   */
  disconnect() {
    this.currentStatus.shutdown = true;
    this.currentStatus.timestamp = Date.now();

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    this.stream.complete();

    if (this.presense) {
      this.presense.complete();
    }

    this.status.next({ ...this.currentStatus });
    this.status.complete();

    if (this.shutdownCallback) {
      this.shutdownCallback();
    }
  }

  shutdownWithError(err: string) {
    this.currentStatus.error = err;
    this.disconnect();
  }
}

// export function initChannel<TMessage = any, TPublish = any, TPresense = any>() {
//   let currentStatus: LiveChannelStatus = {
//     timestamp: Date.now(),
//     connected: false,
//   };
//   const satus: Subject<LiveChannelStatus> = new BehaviorSubject(currentStatus);
//   const stream: Subject<TMessage> = new Subject();
//   const disconnect: () => {};

//   return {
//     disconnect,
//   };
// }

// export class Channel<TMessage = any, TPublish = any, TPresense = any>
//   implements LiveChannel<TMessage, TPublish, TPresense> {
//   // plugin: string;
//   // path: string;
//   // subject: Subject<T>; // private
//   // stream: Observable<T>; // shared
//   // handler: ChannelHandler;
//   // subscription: Centrifuge.Subscription;

//   /** The fully qualified channel id: ${scope}/${namespace}/${path} */
//   readonly id: string;

//   /** The scope for this channel */
//   readonly scope: LiveChannelScope;

//   /** datasourceId/plugin name/feature depending on scope */
//   readonly namespace: string;

//   /** additional qualifier */
//   readonly path: string;

//   /** Static definition of the channel definition.  This may describe the channel usage */
//   config: LiveChannelConfig;

//   constructor() {}

//   /**
//    * Get the channel status
//    */
//   getStatus: () => Observable<LiveChannelStatus>;

//   /**
//    * Get the stream of events and
//    */
//   getStream: () => Observable<TMessage>;

//   /**
//    * Indication of the presense indicator.
//    *
//    * NOTE: This feature is supported by a limited set of channels
//    */
//   getPresense?: () => Observable<TPresense>;

//   /**
//    * Write a message into the channel
//    *
//    * NOTE: This feature is supported by a limited set of channels
//    */
//   publish?: (msg: TPublish) => Promise<any>;

//   /**
//    * This will close and terminate all streams for this channel
//    */
//   disconnect: () => void;
// }

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
    connected: false,
    shutdown: true,
    error: msg,
  };

  return {
    id,
    opened: Date.now(),
    scope,
    namespace,
    path,

    // Using status will return a valid object
    getStatus: () => of(errorStatus),

    // return an error
    getStream: () => throwError(msg),

    // already disconnected
    disconnect: () => {},
  };
}
