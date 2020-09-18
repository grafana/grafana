import Centrifuge, { PublicationContext, SubscriptionEvents } from 'centrifuge/dist/centrifuge.protobuf';
import SockJS from 'sockjs-client';
import { GrafanaLiveSrv, setGrafanaLiveSrv, config } from '@grafana/runtime';
import { Observable, Subject, BehaviorSubject, from } from 'rxjs';
import { share, finalize, mergeMap, take } from 'rxjs/operators';
import { ChannelHandler, ChannelSupport } from '@grafana/data';
import { loadPlugin } from '../plugins/PluginPage';
import { coreGrafanaSupport } from './channels';

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

  readonly centrifuge: Centrifuge;
  readonly connectionState: BehaviorSubject<boolean>;
  readonly connectionBlocker: Promise<void>;

  constructor() {
    this.centrifuge = new Centrifuge(`${config.appUrl}live/sockjs`, {
      debug: true,
      sockjs: SockJS,
    });
    this.centrifuge.connect(); // do connection
    this.connectionState = new BehaviorSubject<boolean>(this.centrifuge.isConnected());
    this.connectionBlocker = new Promise<void>(resolve => {
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
      throw new Error(`Invalid path: ${key}`);
    }

    // Make sure we are connected before trying to subscribe
    if (!this.isConnected()) {
      await this.connectionBlocker;
    }

    const subject = new Subject<T>();
    const callbacks: SubscriptionEvents = {};
    callbacks.publish = handler.onMessageReceived
      ? (ctx: PublicationContext) => {
          subject.next(handler.onMessageReceived!(ctx.data));
        }
      : (ctx: PublicationContext) => {
          subject.next(ctx.data);
        };
    if (handler.onSubscribe) {
      callbacks.subscribe = handler.onSubscribe;
    }
    if (handler.onUnsubscribe) {
      callbacks.unsubscribe = handler.onUnsubscribe;
    }
    if (handler.onError) {
      callbacks.error = handler.onError;
    }
    if (handler.onJoin) {
      callbacks.join = handler.onJoin;
    }
    if (handler.onLeave) {
      callbacks.leave = handler.onLeave;
    }

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

  private async getChannelSupport(pluginId: string): Promise<ChannelSupport> {
    if (pluginId === 'grafana') {
      return Promise.resolve(coreGrafanaSupport);
    }

    const plugin = await loadPlugin(pluginId);
    if (!plugin.channelSupport) {
      throw new Error('Plugin does not have live support configured');
    }

    return plugin.channelSupport;
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
    const support = await this.getChannelSupport(plugin);
    const handler = support.getChannelHandler(path);
    if (!handler) {
      throw new Error(`Invalid path: ${path}`);
    }
    if (!handler.onPublish) {
      throw new Error(`Channel ${path} does not allow publishing`);
    }
    data = handler.onPublish(data);

    // Writes a message over the websocket to grafana server
    return this.centrifuge.publish(`${plugin}/${path}`, data);
  }
}

export function initGrafanaLive() {
  setGrafanaLiveSrv(new CentrifugeSrv());
}
