import { BuildInfo, CurrentUserDTO } from '@grafana/data';
import { BrowserConfig } from '@grafana/faro-web-sdk';
import { EchoEvent, EchoEventType } from '@grafana/runtime';

export interface BaseTransport {
  sendEvent(event: EchoEvent): PromiseLike<Response>;
}

export type GrafanaJavascriptAgentEchoEvent = EchoEvent<EchoEventType.GrafanaJavascriptAgent>;

export interface User extends Pick<CurrentUserDTO, 'email'> {
  id: string;
  orgId?: number;
}

export interface GrafanaJavascriptAgentBackendOptions extends BrowserConfig {
  buildInfo: BuildInfo;
  customEndpoint: string;
  user: User;
  allInstrumentationsEnabled: boolean;
  errorInstrumentalizationEnabled: boolean;
  consoleInstrumentalizationEnabled: boolean;
  webVitalsInstrumentalizationEnabled: boolean;
  tracingInstrumentalizationEnabled: boolean;
  ignoreUrls: RegExp[];
  botFilterEnabled: boolean;
}
