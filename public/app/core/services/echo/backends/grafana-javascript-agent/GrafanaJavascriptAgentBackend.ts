import {
  initializeAgent,
  BrowserConfig,
  ErrorsInstrumentation,
  ConsoleInstrumentation,
  LogLevel,
  WebVitalsInstrumentation,
} from '@grafana/agent-web';
import { BuildInfo } from '@grafana/data';
import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';

import { GrafanaJavascriptAgentEchoEvent, User } from './types';

export interface GrafanaJavascriptAgentBackendOptions extends BrowserConfig {
  buildInfo: BuildInfo;
  customEndpoint: string;
  user: User;
}

export class GrafanaJavascriptAgentBackend
  implements EchoBackend<GrafanaJavascriptAgentEchoEvent, GrafanaJavascriptAgentBackendOptions>
{
  supportedEvents = [EchoEventType.GrafanaJavascriptAgent];
  private agentInstance;

  constructor(public options: GrafanaJavascriptAgentBackendOptions) {
    // initialize GrafanaJavascriptAgent so it can set up it's hooks and start collecting errors
    const grafanaJavaScriptAgentOptions: BrowserConfig = {
      app: {
        version: options.buildInfo.version,
        environment: options.buildInfo.env,
      },
      url: options.customEndpoint || '/log',
      instrumentations: [
        new ErrorsInstrumentation(),
        new ConsoleInstrumentation({
          disabledLevels: [LogLevel.TRACE, LogLevel.ERROR], // console.log will be captured
        }),
        new WebVitalsInstrumentation(),
      ],
    };
    this.agentInstance = initializeAgent(grafanaJavaScriptAgentOptions);
    if (options.user) {
      this.agentInstance.api.setUser({
        email: options.user.email,
        id: options.user.id,
      });
    }
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
