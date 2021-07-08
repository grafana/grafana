import { EchoEvent, EchoEventType } from '@grafana/runtime';

export type PageviewEchoEvent = EchoEvent<EchoEventType.Pageview, { page: string }>;
