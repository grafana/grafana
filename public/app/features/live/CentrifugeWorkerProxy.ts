import CentrifugeWorker from './centrifuge.worker';
import Centrifuge, {
  SubscriptionEvents,
  PresenceResult,
  PresenceStatsResult,
  HistoryResult,
  SubscribeSuccessContext,
  SubscribeErrorContext,
} from 'centrifuge/dist/centrifuge.protobuf';
import { WorkerCommand, WorkerResponse, WorkerResponseBody } from './workerTypes';
import { EventEmitter } from 'events';

export default class CentrifugeWorkerProxy extends EventEmitter {
  worker: Worker;
  subscriptions: Record<string, SubscriptionEvents> = {};
  pendingRequests: Record<string, Record<string, (context: any) => void>> = {};

  constructor(appUrl: string, sessionId: string) {
    super();
    this.worker = new CentrifugeWorker();
    this.worker.postMessage({ id: WorkerCommand.Initialize, data: { appUrl, sessionId } });
    this.worker.onmessage = this.onWorkerMessage.bind(this);
  }

  private onWorkerMessage(message: MessageEvent) {
    const response: WorkerResponseBody = message.data;
    const channelId = response.data?.channelId;

    switch (response.id) {
      case WorkerResponse.Connected:
        this.emit('connect');
        break;
      case WorkerResponse.SubscriptionPublish:
        this.subscriptions[channelId]!.publish!(response.data.context);
        break;
      case WorkerResponse.SubscriptionJoin:
        this.subscriptions[channelId]!.join!(response.data.context);
        break;
      case WorkerResponse.SubscriptionLeave:
        this.subscriptions[channelId]!.leave!(response.data.context);
        break;
      case WorkerResponse.SubscriptionSubscribe:
        this.subscriptions[channelId]!.subscribe!(response.data.context);
        break;
      case WorkerResponse.SubscriptionError:
        this.subscriptions[channelId]!.error!(response.data.context);
        break;
      case WorkerResponse.SubscriptionUnsubscribe:
        this.subscriptions[channelId]!.unsubscribe!(response.data.context);
        break;
      case WorkerResponse.SubscriptionPresence:
        this.pendingRequests[channelId]![WorkerResponse.SubscriptionPresence]!(response.data.context);
        delete this.pendingRequests[channelId]![WorkerResponse.SubscriptionPresence];
        break;
      case WorkerResponse.SubscriptionPresenceStats:
        this.pendingRequests[channelId]![WorkerResponse.SubscriptionPresenceStats]!(response.data.context);
        delete this.pendingRequests[channelId]![WorkerResponse.SubscriptionPresenceStats];
        break;
    }
  }

  connect() {
    console.log('PROXY connect');
    this.worker.postMessage({ id: WorkerCommand.Connect });
  }

  subscribe(channelId: string, events: Centrifuge.SubscriptionEvents): Centrifuge.Subscription {
    console.log('PROXY SUBSCRIBE', channelId, events);
    // const subscription = new SubscriptionWorkerProxy();
    // TODO clear old subscriptions
    this.subscriptions[channelId] = events;
    this.worker.postMessage({ id: WorkerCommand.Subscribe, data: { channelId } });

    return new SubscriptionWorkerProxy(this, channelId, events);
  }

  publish(channelId: string, handler: () => void): Promise<any> {
    console.log('PROXY PUBLISH', channelId, handler);
    return Promise.resolve();
  }

  isConnected(): boolean {
    return false;
  }

  async presence(channelId: string): Promise<PresenceResult> {
    const promise = new Promise<PresenceResult>((resolve) => {
      this.worker.postMessage({ id: WorkerCommand.GetSubscriptionPresence, data: { channelId } });

      const pending: Record<string, (context: any) => void> = {
        [WorkerResponse.SubscriptionPresence]: resolve,
      };

      if (!this.pendingRequests[channelId]) {
        this.pendingRequests[channelId] = pending;
      } else {
        Object.assign(this.pendingRequests[channelId], pending);
      }
    });

    return promise;
  }

  async presenceStats(channelId: string): Promise<PresenceStatsResult> {
    const promise = new Promise<PresenceStatsResult>((resolve) => {
      this.worker.postMessage({ id: WorkerCommand.GetSubscriptionPresenceStats, data: { channelId } });

      const pending: Record<string, (context: any) => void> = {
        [WorkerResponse.SubscriptionPresenceStats]: resolve,
      };

      if (!this.pendingRequests[channelId]) {
        this.pendingRequests[channelId] = pending;
      } else {
        Object.assign(this.pendingRequests[channelId], pending);
      }
    });

    return promise;
  }
}

/* Proxy for Centrifuge.Subscription */
export class SubscriptionWorkerProxy extends EventEmitter {
  channel: string;
  parent: CentrifugeWorkerProxy;
  events: SubscriptionEvents;

  constructor(parent: CentrifugeWorkerProxy, channelId: string, events: SubscriptionEvents) {
    super();
    this.parent = parent;
    this.channel = channelId;
    this.events = events;
  }

  ready(callback: (ctx: SubscribeSuccessContext) => void, errback: (ctx: SubscribeErrorContext) => void): void {
    console.error('ready() is unimplemented in SubscriptionWorkerProxy');
  }

  subscribe(): void {
    this.parent.subscribe(this.channel, this.events);
  }

  unsubscribe(): void {
    console.error('unsubscribe() is unimplemented in SubscriptionWorkerProxy');
  }

  publish(data: any): Promise<any> {
    console.error('publish() is unimplemented in SubscriptionWorkerProxy');
    return Promise.resolve();
  }

  presence(): Promise<PresenceResult> {
    return new Promise(() => {
      return this.parent.presence(this.channel);
    });
  }

  presenceStats(): Promise<PresenceStatsResult> {
    return new Promise(() => {
      return this.parent.presenceStats(this.channel);
    });
  }

  history(): Promise<HistoryResult> {
    console.error('history() is unimplemented in SubscriptionWorkerProxy');
    return new Promise(() => {
      return { publications: [] };
    });
  }
}
