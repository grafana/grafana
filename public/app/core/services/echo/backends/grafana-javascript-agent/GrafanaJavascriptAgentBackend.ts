import { escapeRegex } from '@grafana/data';
import { BaseTransport, defaultInternalLoggerLevel, type Faro } from '@grafana/faro-core';
import { ReplayInstrumentation } from '@grafana/faro-instrumentation-replay';
import {
  initializeFaro,
  BrowserConfig,
  FetchTransport,
  getWebInstrumentations,
  type Instrumentation,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';
import { evaluateBooleanFlag } from '@grafana/runtime/internal';

import { EchoSrvTransport } from './EchoSrvTransport';
import { beforeSendHandler } from './beforeSendHandler';
import { GrafanaJavascriptAgentBackendOptions, GrafanaJavascriptAgentEchoEvent } from './types';

function isCrossOriginIframe() {
  try {
    return document.location.hostname !== window.parent.location.hostname;
  } catch (e) {
    return true;
  }
}

export const TRACKING_URLS = [
  /\.(google-analytics|googletagmanager)\.com/,
  /frontend-metrics/,
  /\/collect(?:\/[\w]*)?$/,
];

export class GrafanaJavascriptAgentBackend
  implements EchoBackend<GrafanaJavascriptAgentEchoEvent, GrafanaJavascriptAgentBackendOptions> {
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
      beforeSend: (item) => beforeSendHandler(options.botFilterEnabled, item),
      internalLoggerLevel: options.internalLoggerLevel ?? defaultInternalLoggerLevel,
    };

    const faro = initializeFaro(grafanaJavaScriptAgentOptions);

    if (faro && evaluateBooleanFlag('faroSessionReplay', false)) {
      this.initReplayAfterDomRendered(faro);
    }
  }

  /**
   * Defer rrweb session replay until React has committed its initial render.
   *
   * rrweb's record() takes a full DOM snapshot on start and then tracks
   * incremental mutations. If it starts before React renders, the snapshot
   * captures an empty #reactRoot and the entire first render arrives as one
   * massive mutation batch — which triggers a known rrweb bug where the
   * MutationBuffer.emit() addList silently drops nodes it cannot resolve.
   * Those dropped nodes later surface as "[replayer] Node with id 'X' not found."
   *
   * By observing #reactRoot for its first child, we start rrweb only after
   * React has committed, so the snapshot contains the real UI and the
   * problematic initial mutation batch never occurs.
   */
  private initReplayAfterDomRendered(faro: Faro): void {
    const addReplay = () => {
      faro.instrumentations.add(
        new ReplayInstrumentation({
          maskAllInputs: true,
          maskTextSelector: '*',
          collectFonts: false,
          inlineImages: false,
          inlineStylesheet: false,
          recordCanvas: false,
          recordCrossOriginIframes: false,
        })
      );
    };

    const reactRoot = document.getElementById('reactRoot');
    if (reactRoot && reactRoot.childNodes.length > 0) {
      requestAnimationFrame(addReplay);
      return;
    }

    const observer = new MutationObserver((_mutations, obs) => {
      obs.disconnect();
      requestAnimationFrame(addReplay);
    });

    observer.observe(reactRoot ?? document.body, { childList: true });
  }

  // noop because the EchoSrvTransport registered in Faro will already broadcast all signals emitted by the Faro API
  addEvent = (e: EchoEvent) => { };

  // backend will log events to stdout, and at least in case of hosted grafana they will be
  // ingested into Loki. Due to Loki limitations logs cannot be backdated,
  // so not using buffering for this backend to make sure that events are logged as close
  // to their context as possible
  flush = () => { };
}
