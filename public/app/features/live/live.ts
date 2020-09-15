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
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { share, finalize } from 'rxjs/operators';

import { registerDashboardWatcher } from './dashboardWatcher';

//http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
export const browserSessionId =
  Math.random()
    .toString(36)
    .substring(2, 15) +
  Math.random()
    .toString(36)
    .substring(2, 15);

interface Channel<T = any> {
  subject: Subject<T>; // private
  stream: Observable<T>;
  subscription?: Centrifuge.Subscription;
}

class CentrifugeSrv implements GrafanaLiveSrv {
  centrifuge: Centrifuge;
  channels = new Map<string, Channel>();
  connectionState: BehaviorSubject<boolean>;
  standardCallbacks: SubscriptionEvents;

  constructor() {
    this.centrifuge = new Centrifuge(`${config.appUrl}live/sockjs`, {
      debug: true,
      sockjs: SockJS,
    });
    this.centrifuge.connect(); // do connection
    this.connectionState = new BehaviorSubject<boolean>(this.centrifuge.isConnected());

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

  initChannel<T>(path: string, handler: ChannelHandler<T>): Observable<T> {
    if (this.channels.has(path)) {
      console.log('Already connected to:', path);
      return this.channels.get(path)!.stream;
    }
    const subject = new Subject<T>();
    const c: Channel = {
      subject,
      stream: subject.pipe(
        finalize(() => {
          console.log('Final listener for', path, c);
          if (c.subscription) {
            c.subscription.unsubscribe();
          }
          this.channels.delete(path); // remove the listener when done
        }),
        share()
      ),
    };

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
    this.channels.set(path, c);
    return c.stream;
  }

  getChannelStream<T>(path: string): Observable<T> {
    const c = this.channels.get(path);
    if (c) {
      return c.stream;
    }
    return this.initChannel(path, noopChannelHandler);
  }

  // Force close everyone who is listening to that channel
  closeChannelStream(path: string) {
    const c = this.channels.get(path);
    if (c) {
      if (c.subscription) {
        c.subscription.unsubscribe();
      }
      this.channels.delete(path);
    }
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

  // Listen for navigation changes
  registerDashboardWatcher();
}
