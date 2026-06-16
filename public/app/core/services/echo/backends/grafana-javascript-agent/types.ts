import { type BuildInfo } from '@grafana/data';
import { type InternalLoggerLevel } from '@grafana/faro-web-sdk';
import { type EchoEvent, type EchoEventType } from '@grafana/runtime';

export type GrafanaJavascriptAgentEchoEvent = EchoEvent<EchoEventType.GrafanaJavascriptAgent>;

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
