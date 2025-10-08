import { BuildInfo, escapeRegex } from '@grafana/data';
import { BaseTransport, defaultInternalLoggerLevel, InternalLoggerLevel } from '@grafana/faro-core';
import {
  initializeFaro,
  BrowserConfig,
  FetchTransport,
  getWebInstrumentations,
  type Instrumentation,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';

import { EchoSrvTransport } from './EchoSrvTransport';
import { beforeSendHandler } from './beforeSendHandler';
import { GrafanaJavascriptAgentEchoEvent } from './types';

function isCrossOriginIframe() {
  try {
    return document.location.hostname !== window.parent.location.hostname;
  } catch (e) {
    return true;
  }
}

export interface GrafanaJavascriptAgentBackendOptions {
  apiKey?: string;
  customEndpoint?: string;
  internalLoggerLevel?: InternalLoggerLevel;

  webVitalsAttribution: boolean;
  consoleInstrumentalizationEnabled: boolean;
  performanceInstrumentalizationEnabled: boolean;
  cspInstrumentalizationEnabled: boolean;
  tracingInstrumentalizationEnabled: boolean;

  buildInfo: BuildInfo;
  userIdentifier: string;
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

  constructor(public options: GrafanaJavascriptAgentBackendOptions) {
    // configure instrumentations.
    const instrumentations: Instrumentation[] = [
      ...getWebInstrumentations({
        captureConsole: options.consoleInstrumentalizationEnabled,
        enablePerformanceInstrumentation: options.performanceInstrumentalizationEnabled,
        enableContentSecurityPolicyInstrumentation: options.cspInstrumentalizationEnabled,
      }),
    ];

    if (options.tracingInstrumentalizationEnabled) {
      instrumentations.push(new TracingInstrumentation());
    }

    const ignoreUrls = [...TRACKING_URLS, ...options.ignoreUrls];
    if (options.customEndpoint) {
      ignoreUrls.unshift(new RegExp(`.*${escapeRegex(options.customEndpoint)}.*`));
    }

    const transports: BaseTransport[] = [new EchoSrvTransport({ ignoreUrls })];

    // If in cross origin iframe, default to writing to instance logging endpoint
    if (options.customEndpoint && !isCrossOriginIframe()) {
      transports.push(new FetchTransport({ url: options.customEndpoint, apiKey: options.apiKey }));
    }

    // initialize GrafanaJavascriptAgent so it can set up its hooks and start collecting errors
    const grafanaJavaScriptAgentOptions: BrowserConfig = {
      app: {
        name: 'grafana-frontend',
        version: options.buildInfo.version,
        environment: options.buildInfo.env,
      },

      user: {
        id: options.userIdentifier,
      },

      instrumentations: instrumentations,
      transports,

      consoleInstrumentation: {
        serializeErrors: true,
      },
      trackWebVitalsAttribution: options.webVitalsAttribution,
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
      beforeSend: beforeSendHandler,
      internalLoggerLevel: options.internalLoggerLevel ?? defaultInternalLoggerLevel,
    };

    initializeFaro(grafanaJavaScriptAgentOptions);
  }

  // noop because the EchoSrvTransport registered in Faro will already broadcast all signals emitted by the Faro API
  addEvent = (e: EchoEvent) => {};

  // backend will log events to stdout, and at least in case of hosted grafana they will be
  // ingested into Loki. Due to Loki limitations logs cannot be backdated,
  // so not using buffering for this backend to make sure that events are logged as close
  // to their context as possible
  flush = () => {};
}
