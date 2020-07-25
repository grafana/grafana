import Centrifuge, { PublicationContext } from 'centrifuge/dist/centrifuge.protobuf';
import SockJS from 'sockjs-client';
import { GrafanaLiveSrv, setGrafanaLiveSrv, ChannelHandler } from '@grafana/runtime';
import { PartialObserver, Unsubscribable, Subject, BehaviorSubject } from 'rxjs';
import { KeyValue } from '@grafana/data';

interface Channel<T = any> {
  subject: Subject<T>;
  subscription?: Centrifuge.Subscription;
}

class CentrifugeSrv implements GrafanaLiveSrv {
  centrifuge: Centrifuge;
  channels: KeyValue<Channel> = {};
  connectionListeners: BehaviorSubject<boolean>;

  constructor() {
    console.log('connecting....');
    // TODO: better pick this from the URL
    this.centrifuge = new Centrifuge(`http://${location.host}/live/sockjs`, {
      debug: true,
      sockjs: SockJS,
    });
    this.centrifuge.setToken('ABCD');
    this.centrifuge.connect(); // do connection
    this.connectionListeners = new BehaviorSubject<boolean>(this.centrifuge.isConnected());

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
    this.connectionListeners.next(true);
  };

  onDisconnect = (context: any) => {
    console.log('onDisconnect', context);
    this.connectionListeners.next(false);
  };

  onServerSideMessage = (context: any) => {
    console.log('Publication from server-side channel', context);
  };

  //----------------------------------------------------------
  // Exported functions
  //----------------------------------------------------------

  /**
   * Is the server currently connected
   */
  isConnected = (): boolean => {
    return this.centrifuge.isConnected();
  };

  /**
   * Listen for changes to the connection state
   */
  connection = (observer: PartialObserver<boolean>): Unsubscribable => {
    return this.connectionListeners.subscribe(observer);
  };

  initChannel = <T>(path: string, handler: ChannelHandler<T>) => {
    if (this.channels[path]) {
      console.log('Already connected to:', path);
      return;
    }
    const c: Channel = {
      subject: new Subject<T>(),
    };
    this.channels[path] = c;

    console.log('initChannel', this.centrifuge.isConnected(), path, handler);
    c.subscription = this.centrifuge.subscribe(path, (ctx: PublicationContext) => {
      console.log('GOT', JSON.stringify(ctx.data), ctx);
      const v = handler.onPublish(ctx.data);
      c.subject.next(v);
    });
  };

  subscribe = <T>(path: string, observer: PartialObserver<T>): Unsubscribable => {
    let c = this.channels[path];
    if (!c) {
      this.initChannel(path, standardChannelHandler);
      c = this.channels[path];
    }
    return c!.subject.subscribe(observer);
  };

  /**
   * Send data to a channel.  This feature is disabled for most channels and will return an error
   */
  publish = <T>(channel: string, data: any): Promise<T> => {
    return this.centrifuge.publish(channel, data);
  };
}

export const standardChannelHandler: ChannelHandler = {
  onPublish: (v: any) => {
    return v;
  },
};

export function initGrafanaLive() {
  setGrafanaLiveSrv(new CentrifugeSrv());
}
