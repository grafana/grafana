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
import { Trie } from '@grafana/data';

interface Channel<T = any> {
  plugin: string;
  path: string;
  subject: Subject<T>; // private
  stream: Observable<T>; // shared
  handler: ChannelHandler;
  subscription: Centrifuge.Subscription;
}

interface PluginChannelSupport {
  plugin: string;
  paths: Map<string, ChannelHandler>;
  prefix: Trie<ChannelHandler>;
}

class CentrifugeSrv implements GrafanaLiveSrv {
  readonly channels = new Map<string, Channel>();
  readonly plugins = new Map<string, PluginChannelSupport>();

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

  /**
   * Returns a channel that has been initalized and subscribed to the given path
   */
  private getChannel<T>(id: string) {
    let channel = this.channels.get(id);
    if (channel) {
      return channel;
    }
    const { plugin, path, handler } = this.getHandlerInfo(id);

    const subject = new Subject<T>();
    const callbacks: SubscriptionEvents = {
      ...this.standardCallbacks,
      publish: (ctx: PublicationContext) => {
        // console.log('GOT', JSON.stringify(ctx.data), ctx);
        const v = handler!.onMessageReceived(ctx.data);
        subject.next(v);
      },
    };
    console.log('initChannel', this.centrifuge.isConnected(), path, handler);
    const subscription = this.centrifuge.subscribe(path, callbacks);
    channel = {
      plugin,
      path,
      subject,
      stream: subject.pipe(
        finalize(() => {
          console.log('Final listener for', path);
          if (subscription) {
            subscription.unsubscribe();
          }
          this.channels.delete(path); // remove the listener when done
        }),
        share()
      ),
      handler,
      subscription,
    };
    this.channels.set(path, channel);
    return channel;
  }

  private getHandlerInfo(id: string) {
    const idx = id.indexOf('/');
    if (idx < 1) {
      throw new Error('Invalid channel.  expecting `${pluginId}/path`');
    }
    const plugin = id.substring(0, idx);
    const path = id.substring(idx + 1);
    const support = this.plugins.get(plugin);
    if (!support) {
      throw new Error('No channels are configured for plugin: ' + plugin);
    }

    let handler = support.paths.get(path);
    if (!handler) {
      handler = support.prefix.find(path);
    }
    if (!handler) {
      throw new Error('No handler registered for channel: ' + id);
    }
    return {
      plugin,
      path,
      handler,
    };
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

  registerChannelSupport<T>(plugin: string, path: string, handler?: ChannelHandler<T>) {
    let support = this.plugins.get(plugin);
    if (!support) {
      support = {
        plugin,
        paths: new Map<string, ChannelHandler>(),
        prefix: new Trie<ChannelHandler>(),
      };
      this.plugins.set(plugin, support);
    }
    if (!handler) {
      handler = noopChannelHandler;
    }

    if (path.endsWith('*')) {
      support.prefix.insert(path.substring(0, path.length - 1), handler);
    } else {
      support.paths.set(path, handler);
    }
  }

  getChannelStream<T>(path: string): Observable<T> {
    return this.getChannel(path).stream; // shared with ref count
  }

  /**
   * Send data to a channel.  This feature is disabled for most channels and will return an error
   */
  publish<T>(channel: string, data: any): Promise<T> {
    try {
      const { handler } = this.getHandlerInfo(channel);
      if (!handler.allowPublish) {
        return Promise.reject({
          text: `Channel ${channel} does not allow publishing`,
        });
      }
      // Writes a message over the websocket to grafana server
      return this.centrifuge.publish(channel, data);
    } catch (err) {
      return Promise.reject({
        text: `${err}`,
      });
    }
  }
}

const noopChannelHandler: ChannelHandler = {
  onMessageReceived: (v: any) => {
    return v; // Just pass the object along
  },
};

export function initGrafanaLive() {
  setGrafanaLiveSrv(new CentrifugeSrv());
}
