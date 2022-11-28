import { BaseTransport } from '@grafana/agent-core';
import {
  initializeAgent,
  BrowserConfig,
  ErrorsInstrumentation,
  ConsoleInstrumentation,
  WebVitalsInstrumentation,
  FetchTransport,
} from '@grafana/agent-web';
import { BuildInfo } from '@grafana/data';
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
  private agentInstance;
  transports: BaseTransport[];

  constructor(public options: GrafanaJavascriptAgentBackendOptions) {
    // configure instrumentalizations
    const instrumentations = [];
    this.transports = [];

    if (options.customEndpoint) {
      this.transports.push(new FetchTransport({ url: options.customEndpoint, apiKey: options.apiKey }));
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

    // initialize GrafanaJavascriptAgent so it can set up its hooks and start collecting errors
    const grafanaJavaScriptAgentOptions: BrowserConfig = {
      globalObjectKey: options.globalObjectKey || 'grafanaAgent',
      preventGlobalExposure: options.preventGlobalExposure || false,
      app: {
        version: options.buildInfo.version,
        environment: options.buildInfo.env,
      },
      instrumentations,
      transports: [new EchoSrvTransport()],
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Non-Error exception captured with keys',
      ],
    };
    this.agentInstance = initializeAgent(grafanaJavaScriptAgentOptions);

    if (options.user) {
      this.agentInstance.api.setUser({
        email: options.user.email,
        id: options.user.id,
        attributes: {
          orgId: String(options.user.orgId) || '',
        },
      });
    }
  }

  addEvent = (e: EchoEvent) => {
    this.transports.forEach((t) => t.send(e.payload));
  };

  // backend will log events to stdout, and at least in case of hosted grafana they will be
  // ingested into Loki. Due to Loki limitations logs cannot be backdated,
  // so not using buffering for this backend to make sure that events are logged as close
  // to their context as possible
  flush = () => {};
}
