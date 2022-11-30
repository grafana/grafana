import { Event as SentryEvent } from '@sentry/browser';

import { EchoEvent, EchoEventType } from '@grafana/runtime';

export interface BaseTransport {
  sendEvent(event: SentryEvent): PromiseLike<void>;
}

export type SentryEchoEvent = EchoEvent<EchoEventType.Sentry, SentryEvent>;

export interface User {
  email: string;
  id: number;
  orgId: number;
}
