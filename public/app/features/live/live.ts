import Centrifuge, {
  PublicationContext,
  SubscriptionEvents,
  SubscribeSuccessContext,
  UnsubscribeContext,
  JoinLeaveContext,
  SubscribeErrorContext,
} from 'centrifuge/dist/centrifuge.protobuf';
import SockJS from 'sockjs-client';
import { GrafanaLiveSrv, setGrafanaLiveSrv, config } from '@grafana/runtime';
import { Observable, Subject, BehaviorSubject, from } from 'rxjs';
import { share, finalize, mergeMap, take } from 'rxjs/operators';
import { ChannelHandler, LiveChannelSupport } from '@grafana/data';
import { loadPlugin } from '../plugins/PluginPage';

interface Channel<T = any> {
  plugin: string;
  path: string;
  subject: Subject<T>; // private
  stream: Observable<T>; // shared
  handler: ChannelHandler;
  subscription: Centrifuge.Subscription;
}

class CentrifugeSrv implements GrafanaLiveSrv {
  readonly channels = new Map<string, Channel>();

  centrifuge: Centrifuge;
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

  /**
   * Returns a channel that has been initalized and subscribed to the given path
   */
  private async getChannel<T>(pluginId: string, path: string): Promise<Channel<T>> {
    const key = `${pluginId}/${path}`;
    const c = this.channels.get(key);
    if (c) {
      return Promise.resolve(c);
    }

    const liveSupport = await this.getChannelSupport(pluginId);
    const handler = liveSupport.getChannelHandler(path);
    if (!handler) {
      return Promise.reject(`Invalid path: ${key}`);
    }

    // Make sure we are connected before trying to subscribe
    if (!this.isConnected()) {
      await new Promise<void>(resolve => {
        if (this.centrifuge.isConnected()) {
          return resolve();
        }
        const connectListener = () => {
          resolve();
          this.centrifuge.removeListener('connect', connectListener);
        };
        this.centrifuge.addListener('connect', connectListener);
      });
    }

    const subject = new Subject<T>();
    const callbacks: SubscriptionEvents = {
      ...this.standardCallbacks,
      publish: (ctx: PublicationContext) => {
        // console.log('GOT', JSON.stringify(ctx.data), ctx);
        const v = handler!.onMessageReceived(ctx.data);
        subject.next(v);
      },
    };
    console.log('initChannel', this.centrifuge.isConnected(), key, handler);
    const subscription = this.centrifuge.subscribe(key, callbacks);
    const channel = {
      plugin: pluginId,
      path,
      subject,
      stream: subject.pipe(
        finalize(() => {
          console.log('Final listener for', key);
          if (subscription) {
            subscription.unsubscribe();
          }
          this.channels.delete(key); // remove the listener when done
        }),
        share()
      ),
      handler,
      subscription,
    };
    this.channels.set(key, channel);
    return channel;
  }

  private async getChannelSupport(pluginId: string): Promise<LiveChannelSupport> {
    return loadPlugin(pluginId).then(plugin => {
      if (!plugin.liveSupport) {
        return Promise.reject('Plugin does not have live support configured');
      }
      return plugin.liveSupport;
    });
  }

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

  getChannelStream<T>(plugin: string, path: string): Observable<T> {
    return from(this.getChannel<T>(plugin, path)).pipe(
      take(1), // This converts the promise to observable
      mergeMap(c => c.stream)
    );
  }

  /**
   * Send data to a channel.  This feature is disabled for most channels and will return an error
   */
  async publish<T>(plugin: string, path: string, data: any): Promise<T> {
    try {
      const support = await this.getChannelSupport(plugin);
      if (!support.onPublish) {
        return Promise.reject({
          text: `Channel ${path} does not allow publishing`,
        });
      }
      data = support.onPublish(path, data);

      // Writes a message over the websocket to grafana server
      return this.centrifuge.publish(`${plugin}/${path}`, data);
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

export function initGrafanaLive() {
  setGrafanaLiveSrv(new CentrifugeSrv());
}
