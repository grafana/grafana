import { EchoBackend, EchoEventType } from '@grafana/runtime';
import { SentryConfig } from '@grafana/data/src/types/config';
import { BrowserOptions, init as initSentry, setUser as sentrySetUser } from '@sentry/browser';
import { FetchTransport } from '@sentry/browser/dist/transports';
import { CustomEndpointTransport } from './transports/CustomEndpointTransport';
import { EchoSrvTransport } from './transports/EchoSrvTransport';
import { BuildInfo } from '@grafana/data';
import { SentryEchoEvent, User, BaseTransport } from './types';

export interface SentryEchoBackendOptions extends SentryConfig {
  user?: User;
  buildInfo: BuildInfo;
}

export class SentryEchoBackend implements EchoBackend<SentryEchoEvent, SentryEchoBackendOptions> {
  supportedEvents = [EchoEventType.Sentry];

  transports: BaseTransport[];

  constructor(public options: SentryEchoBackendOptions) {
    // set up transports to post events to grafana backend and/or Sentry
    this.transports = [];
    if (options.dsn) {
      this.transports.push(new FetchTransport({ dsn: options.dsn }));
    }
    if (options.customEndpoint) {
      this.transports.push(new CustomEndpointTransport({ endpoint: options.customEndpoint }));
    }

    // initialize Sentry so it can set up it's hooks and start collecting errors
    const sentryOptions: BrowserOptions = {
      release: options.buildInfo.version,
      environment: options.buildInfo.env,
      // seems Sentry won't attempt to send events to transport unless a valid DSN is defined :shrug:
      dsn: options.dsn || 'https://examplePublicKey@o0.ingest.sentry.io/0',
      sampleRate: options.sampleRate,
      transport: EchoSrvTransport, // will dump errors to EchoSrv
    };

    if (options.user) {
      sentrySetUser({
        email: options.user.email,
        id: String(options.user.id),
      });
    }

    initSentry(sentryOptions);
  }

  addEvent = (e: SentryEchoEvent) => {
    this.transports.forEach((t) => t.sendEvent(e.payload));
  };

  // backend will log events to stdout, and at least in case of hosted grafana they will be
  // ingested into Loki. Due to Loki limitations logs cannot be backdated,
  // so not using buffering for this backend to make sure that events are logged as close
  // to their context as possible
  flush = () => {};
}
