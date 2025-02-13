import { BuildInfo, escapeRegex } from '@grafana/data';
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
  getWebInstrumentations,
  Config,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';

import { EchoSrvTransport } from './EchoSrvTransport';
import { GrafanaJavascriptAgentEchoEvent, User } from './types';

function isCrossOriginIframe() {
  try {
    return document.location.hostname !== window.parent.location.hostname;
  } catch (e) {
    return true;
  }
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
}

export const TRACKING_URLS = [
  /\.(google-analytics|googletagmanager)\.com/,
  /frontend-metrics/,
  /\/collect(?:\/[\w]*)?$/,
];

export class GrafanaJavascriptAgentBackend
  implements EchoBackend<GrafanaJavascriptAgentEchoEvent, GrafanaJavascriptAgentBackendOptions>
{
  supportedEvents = [EchoEventType.GrafanaJavascriptAgent];
  private faroInstance;

  constructor(public options: GrafanaJavascriptAgentBackendOptions) {
    // configure instrumentations.
    const instrumentations: Instrumentation[] = [];

    const ignoreUrls = [
      new RegExp(`.*${escapeRegex(options.customEndpoint)}.*`),
      ...TRACKING_URLS,
      ...options.ignoreUrls,
    ];

    const transports: BaseTransport[] = [new EchoSrvTransport({ ignoreUrls })];
    const consoleInstrumentationOptions: Config['consoleInstrumentation'] =
      options.allInstrumentationsEnabled || options.consoleInstrumentalizationEnabled
        ? {
            serializeErrors: true,
          }
        : {};

    // If in cross origin iframe, default to writing to instance logging endpoint
    if (options.customEndpoint && !isCrossOriginIframe()) {
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
    if (options.tracingInstrumentalizationEnabled) {
      instrumentations.push(new TracingInstrumentation());
    }

    // session instrumentation must be added!
    instrumentations.push(new SessionInstrumentation());

    // initialize GrafanaJavascriptAgent so it can set up its hooks and start collecting errors
    const grafanaJavaScriptAgentOptions: BrowserConfig = {
      globalObjectKey: options.globalObjectKey || 'faro',
      preventGlobalExposure: options.preventGlobalExposure || false,
      app: {
        name: 'grafana-frontend',
        version: options.buildInfo.version,
        environment: options.buildInfo.env,
      },
      instrumentations: options.allInstrumentationsEnabled
        ? instrumentations
        : [...getWebInstrumentations(), new TracingInstrumentation()],
      consoleInstrumentation: consoleInstrumentationOptions,
      transports,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Non-Error exception captured with keys',
        'Failed sending payload to the receiver',
      ],
      ignoreUrls,
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
