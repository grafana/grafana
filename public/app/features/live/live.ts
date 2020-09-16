import Centrifuge, {
  PublicationContext,
  SubscriptionEvents,
  SubscribeSuccessContext,
  UnsubscribeContext,
  JoinLeaveContext,
  SubscribeErrorContext,
} from 'centrifuge/dist/centrifuge.protobuf';
import SockJS from 'sockjs-client';
import { GrafanaLiveSrv, setGrafanaLiveSrv, ChannelHandler, config } from '@grafana/runtime';
import { Observable, Subject, BehaviorSubject, from } from 'rxjs';
import { KeyValue } from '@grafana/data';
import { mergeMap, take } from 'rxjs/operators';

interface Channel<T = any> {
  subject: Subject<T>;
  subscription?: Centrifuge.Subscription;
}

class CentrifugeSrv implements GrafanaLiveSrv {
  centrifuge: Centrifuge;
  channels: KeyValue<Channel> = {};
  connectionState: BehaviorSubject<boolean>;
  connected: Observable<void>;
  standardCallbacks: SubscriptionEvents;

  constructor() {
    this.centrifuge = new Centrifuge(`${config.appUrl}live/sockjs`, {
      debug: true,
      sockjs: SockJS,
    });
    this.centrifuge.connect(); // do connection
    this.connectionState = new BehaviorSubject<boolean>(this.centrifuge.isConnected());
    this.connected = from(
      new Promise<void>(resolve => {
        if (this.centrifuge.isConnected()) {
          return resolve();
        }

        this.centrifuge.addListener('connect', resolve);
      })
    );

    // Register global listeners
    this.centrifuge.on('connect', this.onConnect);
    this.centrifuge.on('disconnect', this.onDisconnect);
    this.centrifuge.on('publish', this.onServerSideMessage);

    this.standardCallbacks = {
      subscribe: this.onSubscribe,
      unsubscribe: this.onUnsubscribe,
      join: this.onJoin,
      leave: this.onLeave,
      error: this.onError,
    };
  }

  //----------------------------------------------------------
  // Internal functions
  //----------------------------------------------------------

  onConnect = (context: any) => {
    console.log('CONNECT', context);
    this.connectionState.next(true);
  };

  onDisconnect = (context: any) => {
    console.log('onDisconnect', context);
    this.connectionState.next(false);
  };

  onServerSideMessage = (context: any) => {
    console.log('Publication from server-side channel', context);
  };

  //----------------------------------------------------------
  // Channel functions
  //----------------------------------------------------------

  //   export interface SubscriptionEvents {
  //     publish?: (ctx: PublicationContext) => void;
  //     join?: (ctx: JoinLeaveContext) => void;
  //     leave?: (ctx: JoinLeaveContex) => void;
  //     subscribe?: (ctx: SubscribeSuccessContext) => void;
  //     error?: (ctx: SubscribeErrorContext) => void;
  //     unsubscribe?: (ctx: UnsubscribeContext) => void;
  // }

  onSubscribe = (context: SubscribeSuccessContext) => {
    console.log('onSubscribe', context);
  };

  onUnsubscribe = (context: UnsubscribeContext) => {
    console.log('onUnsubscribe', context);
  };

  onJoin = (context: JoinLeaveContext) => {
    console.log('onJoin', context);
  };

  onLeave = (context: JoinLeaveContext) => {
    console.log('onLeave', context);
  };

  onError = (context: SubscribeErrorContext) => {
    console.log('onError', context);
  };

  //----------------------------------------------------------
  // Exported functions
  //----------------------------------------------------------

  /**
   * Is the server currently connected
   */
  isConnected() {
    return this.centrifuge.isConnected();
  }

  /**
   * Listen for changes to the connection state
   */
  getConnectionState() {
    return this.connectionState.asObservable();
  }

  initChannel<T>(path: string, handler: ChannelHandler<T>) {
    if (this.channels[path]) {
      console.log('Already connected to:', path);
      return this.connected;
    }
    const c: Channel = {
      subject: new Subject<T>(),
    };
    this.channels[path] = c;

    console.log('initChannel', this.centrifuge.isConnected(), path, handler);
    const callbacks: SubscriptionEvents = {
      ...this.standardCallbacks,
      publish: (ctx: PublicationContext) => {
        // console.log('GOT', JSON.stringify(ctx.data), ctx);
        const v = handler.onPublish(ctx.data);
        c.subject.next(v);
      },
    };
    c.subscription = this.centrifuge.subscribe(path, callbacks);
    return this.connected;
  }

  getChannelStream<T>(path: string): Observable<T> {
    const connected = this.initChannel(path, noopChannelHandler);
    const c = this.channels[path];

    return connected.pipe(
      take(1),
      mergeMap(() => c!.subject.asObservable())
    );
  }

  /**
   * Send data to a channel.  This feature is disabled for most channels and will return an error
   */
  publish<T>(channel: string, data: any): Promise<T> {
    return this.centrifuge.publish(channel, data);
  }
}

const noopChannelHandler: ChannelHandler = {
  onPublish: (v: any) => {
    return v; // Just pass the object along
  },
};

export function initGrafanaLive() {
  setGrafanaLiveSrv(new CentrifugeSrv());
}
