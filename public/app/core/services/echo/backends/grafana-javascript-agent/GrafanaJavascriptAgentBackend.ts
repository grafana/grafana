import { BuildInfo } from '@grafana/data';
import { BaseTransport, defaultInternalLoggerLevel } from '@grafana/faro-core';
import {
  initializeFaro,
  BrowserConfig,
  ErrorsInstrumentation,
  ConsoleInstrumentation,
  WebVitalsInstrumentation,
  SessionInstrumentation,
  FetchTransport,
  type Instrumentation,
} from '@grafana/faro-web-sdk';
import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';

import { EchoSrvTransport } from './EchoSrvTransport';
import { GrafanaJavascriptAgentEchoEvent, User } from './types';

export interface GrafanaJavascriptAgentBackendOptions extends BrowserConfig {
  buildInfo: BuildInfo;
  customEndpoint: string;
  user: User;
  errorInstrumentalizationEnabled: boolean;
  consoleInstrumentalizationEnabled: boolean;
  webVitalsInstrumentalizationEnabled: boolean;
}

export class GrafanaJavascriptAgentBackend
  implements EchoBackend<GrafanaJavascriptAgentEchoEvent, GrafanaJavascriptAgentBackendOptions>
{
  supportedEvents = [EchoEventType.GrafanaJavascriptAgent];
  private faroInstance;

  constructor(public options: GrafanaJavascriptAgentBackendOptions) {
    // configure instrumentations.
    const instrumentations: Instrumentation[] = [];

    const transports: BaseTransport[] = [new EchoSrvTransport()];

    if (options.customEndpoint) {
      transports.push(new FetchTransport({ url: options.customEndpoint, apiKey: options.apiKey }));
    }

    if (options.errorInstrumentalizationEnabled) {
      instrumentations.push(new ErrorsInstrumentation());
    }
    if (options.consoleInstrumentalizationEnabled) {
      instrumentations.push(new ConsoleInstrumentation());
    }
    if (options.webVitalsInstrumentalizationEnabled) {
      instrumentations.push(new WebVitalsInstrumentation());
    }

    // session instrumentation must be added!
    instrumentations.push(new SessionInstrumentation());

    // initialize GrafanaJavascriptAgent so it can set up its hooks and start collecting errors
    const grafanaJavaScriptAgentOptions: BrowserConfig = {
      globalObjectKey: options.globalObjectKey || 'faro',
      preventGlobalExposure: options.preventGlobalExposure || false,
      app: {
        version: options.buildInfo.version,
        environment: options.buildInfo.env,
      },
      instrumentations,
      transports,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Non-Error exception captured with keys',
      ],
      sessionTracking: {
        persistent: true,
      },
      batching: {
        sendTimeout: 1000,
      },
      internalLoggerLevel: options.internalLoggerLevel || defaultInternalLoggerLevel,
    };
    this.faroInstance = initializeFaro(grafanaJavaScriptAgentOptions);

    if (options.user) {
      this.faroInstance.api.setUser({
        id: options.user.id,
        attributes: {
          orgId: String(options.user.orgId) || '',
        },
      });
    }
  }

  // noop because the EchoSrvTransport registered in Faro will already broadcast all signals emitted by the Faro API
  addEvent = (e: EchoEvent) => {};

  // backend will log events to stdout, and at least in case of hosted grafana they will be
  // ingested into Loki. Due to Loki limitations logs cannot be backdated,
  // so not using buffering for this backend to make sure that events are logged as close
  // to their context as possible
  flush = () => {};
}
