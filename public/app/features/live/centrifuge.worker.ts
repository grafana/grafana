import Centrifuge, {
  PublicationContext,
  JoinLeaveContext,
  SubscribeSuccessContext,
  SubscribeErrorContext,
  UnsubscribeContext,
  SubscriptionEvents,
} from 'centrifuge/dist/centrifuge';
import { WorkerCommand, WorkerResponse } from './workerTypes';

const ctx: Worker = self as any;
let centrifuge: Centrifuge;
const subscriptions: Record<string, Centrifuge.Subscription> = {};

const initialize = ({ appUrl, sessionId }: { appUrl: string; sessionId: string }) => {
  // build live url replacing scheme in appUrl.
  const liveUrl = `${appUrl}live/ws`.replace(/^(http)(s)?:\/\//, 'ws$2://');
  centrifuge = new Centrifuge(liveUrl, {
    debug: true,
  });
  centrifuge.setConnectData({
    sessionId,
  });
  centrifuge.on('connect', onConnected);
  centrifuge.on('disconnect', onDisconnected);
  centrifuge.on('publish', onPublish);
};

const connect = () => {
  console.log('WORKER: Connecting centrifuge');
  centrifuge.connect(); // do connection
};

const subscribe = (channelId: string, subscriptionEvents: SubscriptionEvents) => {
  console.log('WORKER Subscribe', channelId);
  subscriptions[channelId] = centrifuge.subscribe(channelId, subscriptionEvents);
};
const onConnected = () => {
  console.log('WORKER onConnected');
  ctx.postMessage({ id: WorkerResponse.Connected });
};

const onDisconnected = () => {
  console.log('WORKER onDisconnected');
  ctx.postMessage({ id: WorkerResponse.Disconnected });
};

const onPublish = (data: any) => {
  console.log('WORKER onPublish');

  ctx.postMessage({ id: WorkerResponse.Publish, data });
};

const subscribeEventHandlers = (channelId: string): SubscriptionEvents => ({
  publish: (context: PublicationContext) => {
    ctx.postMessage({
      id: WorkerResponse.SubscriptionPublish,
      data: { channelId, context },
    });
  },
  join: (context: JoinLeaveContext) => {
    ctx.postMessage({
      id: WorkerResponse.SubscriptionJoin,
      data: { channelId, context },
    });
  },
  leave: (context: JoinLeaveContext) => {
    ctx.postMessage({
      id: WorkerResponse.SubscriptionLeave,
      data: { channelId, context },
    });
  },
  subscribe: (context: SubscribeSuccessContext) => {
    ctx.postMessage({
      id: WorkerResponse.SubscriptionSubscribe,
      data: { channelId, context },
    });
  },
  error: (context: SubscribeErrorContext) => {
    ctx.postMessage({
      id: WorkerResponse.SubscriptionError,
      data: { channelId, context },
    });
  },
  unsubscribe: (context: UnsubscribeContext) => {
    ctx.postMessage({
      id: WorkerResponse.SubscriptionUnsubscribe,
      data: { channelId, context },
    });
  },
});

ctx.onmessage = function (event: MessageEvent) {
  const command: { id: WorkerCommand; data: any } = event.data;

  console.log('WORKER: Command Received', command);
  switch (command.id) {
    case WorkerCommand.Initialize:
      initialize(command.data);
      break;
    case WorkerCommand.Connect:
      connect();
      break;
    case WorkerCommand.Subscribe:
      subscribe(command.data.channelId, subscribeEventHandlers(command.data.channelId));
      break;
    case WorkerCommand.GetSubscriptionPresence:
      subscriptions[command.data.channelId].presence().then((context) => {
        ctx.postMessage({ id: WorkerResponse.SubscriptionPresence, data: { context } });
      });
      break;
    case WorkerCommand.GetSubscriptionPresenceStats:
      subscriptions[command.data.channelId].presenceStats().then((context) => {
        ctx.postMessage({ id: WorkerResponse.SubscriptionPresenceStats, data: { context } });
      });
      break;
  }
};

console.log('WORKER loaded');

/* Export this, so typescript knows this module represents a worker.
It's actually not used anywhere else, since worker-loader transforms this into something else  */
export default class extends Worker {
  constructor() {
    super('');
  }
}
