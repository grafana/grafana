import { initializeAgent, BrowserConfig } from '@grafana/agent-web';
import { BuildInfo } from '@grafana/data';
import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';

import { GrafanaJavascriptAgentEchoEvent } from './types';

export interface GrafanaJavascriptAgentBackendOptions extends BrowserConfig {
  buildInfo: BuildInfo;
  customEndpoint: string;
}

export class GrafanaJavascriptAgentBackend
  implements EchoBackend<GrafanaJavascriptAgentEchoEvent, GrafanaJavascriptAgentBackendOptions>
{
  supportedEvents = [EchoEventType.Sentry];
  private agentInstance;

  // transports: BaseTransport[];

  constructor(public options: GrafanaJavascriptAgentBackendOptions) {
    //  set up transports to post events to grafana backend and/or Sentry
    // this.transports = [];
    // if (options.customEndpoint) {
    //   this.transports.push(new CustomEndpointTransport({ endpoint: options.customEndpoint }));
    // }

    // initialize Sentry so it can set up it's hooks and start collecting errors
    const grafanaJavaScriptAgentOptions: BrowserConfig = {
      app: {
        version: options.buildInfo.version,
        environment: options.buildInfo.env,
      },
      url: options.customEndpoint || '/log',
    };

    /*if (options.user) {
      sentrySetUser({
        email: options.user.email,
        id: String(options.user.id),
      });
    }*/

    this.agentInstance = initializeAgent(grafanaJavaScriptAgentOptions);
  }

  addEvent = (e: EchoEvent) => {
    this.agentInstance.api.pushLog(e.payload);
  };

  // backend will log events to stdout, and at least in case of hosted grafana they will be
  // ingested into Loki. Due to Loki limitations logs cannot be backdated,
  // so not using buffering for this backend to make sure that events are logged as close
  // to their context as possible
  flush = () => {};
}
