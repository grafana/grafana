import { Event as SentryEvent } from '@sentry/browser';
import { Response } from '@sentry/types';

import { EchoEvent, EchoEventType } from '@grafana/runtime';

export interface BaseTransport {
  sendEvent(event: SentryEvent): PromiseLike<Response>;
}

export type SentryEchoEvent = EchoEvent<EchoEventType.Sentry, SentryEvent>;

export interface User {
  email: string;
  id: number;
  orgId: number;
}
