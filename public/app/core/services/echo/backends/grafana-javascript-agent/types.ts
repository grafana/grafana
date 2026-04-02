import { type BuildInfo, type CurrentUserDTO } from '@grafana/data';
import { type InternalLoggerLevel } from '@grafana/faro-web-sdk';
import { type EchoEvent, type EchoEventType } from '@grafana/runtime';

export interface BaseTransport {
  sendEvent(event: EchoEvent): PromiseLike<Response>;
}

export type GrafanaJavascriptAgentEchoEvent = EchoEvent<EchoEventType.GrafanaJavascriptAgent>;

export interface User extends Pick<CurrentUserDTO, 'email'> {
  id: string;
  orgId?: number;
}

export interface GrafanaJavascriptAgentBackendOptions {
  apiKey?: string;
  customEndpoint?: string;
  internalLoggerLevel?: InternalLoggerLevel;

  consoleInstrumentalizationEnabled: boolean;
  performanceInstrumentalizationEnabled: boolean;
  cspInstrumentalizationEnabled: boolean;
  tracingInstrumentalizationEnabled: boolean;

  buildInfo: BuildInfo;
  userIdentifier: string;
  ignoreUrls: RegExp[];
  botFilterEnabled: boolean;
}
