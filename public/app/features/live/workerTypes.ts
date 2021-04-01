export enum WorkerCommand {
  Initialize,
  Connect,
  GetConnectionStatus,
  Subscribe,
  GetSubscriptionPresence,
  GetSubscriptionPresenceStats,
}

export enum WorkerResponse {
  Connected,
  Disconnected,
  Publish,
  SubscriptionPublish,
  SubscriptionJoin,
  SubscriptionLeave,
  SubscriptionSubscribe,
  SubscriptionError,
  SubscriptionUnsubscribe,
  SubscriptionPresence,
  SubscriptionPresenceStats,
}

export interface WorkerResponseBody {
  id: WorkerResponse;
  data?: any;
}

export interface WorkerCommandBody {
  id: WorkerCommand;
  data?: any;
}
