import { init } from '@fullstory/browser';

import { EchoBackend, EchoEventType, FullstoryEchoEvent } from '@grafana/runtime';

export interface FullstoryBackendOptions {
  orgId: string;
  devMode?: boolean;
}

export class FullstoryBackend implements EchoBackend<FullstoryEchoEvent, FullstoryBackendOptions> {
  supportedEvents = [EchoEventType.Fullstory];

  constructor(public options: FullstoryBackendOptions) {
    init({ orgId: options.orgId, devMode: options.devMode ?? false, debug: options.devMode ?? false });
  }

  // Not using custom events, Fullstory track every interaction automatically
  addEvent = (e: FullstoryEchoEvent) => {};

  // Not using Echo buffering
  flush = () => {};
}
