import $ from 'jquery';

import {
  EchoBackend,
  EchoEventType,
  InteractionEchoEvent,
  isInteractionEvent,
  isPageviewEvent,
  PageviewEchoEvent,
} from '@grafana/runtime';

interface ApplicationInsights {
  trackPageView: () => void;
  trackEvent: (event: { name: string; properties?: Record<string, any> }) => void;
}

declare global {
  interface Window {
    // We say all methods are undefined because we can't be sure they're there
    // and we should be extra cautious
    applicationInsights?: Partial<ApplicationInsights>;
  }
}

export interface ApplicationInsightsBackendOptions {
  connectionString: string;
  endpointUrl?: string;
}

export class ApplicationInsightsBackend implements EchoBackend<PageviewEchoEvent, ApplicationInsightsBackendOptions> {
  supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction];

  constructor(public options: ApplicationInsightsBackendOptions) {
    $.ajax({
      url: 'https://js.monitor.azure.com/scripts/b/ai.2.min.js',
      dataType: 'script',
      cache: true,
    }).done(function () {
      const applicationInsightsOpts = {
        config: {
          connectionString: options.connectionString,
          endpointUrl: options.endpointUrl,
        },
      };

      const init = new (window as any).Microsoft.ApplicationInsights.ApplicationInsights(applicationInsightsOpts);
      (window as any).applicationInsights = init.loadAppInsights();
    });
  }

  addEvent = (e: PageviewEchoEvent | InteractionEchoEvent) => {
    if (!window.applicationInsights) {
      return;
    }

    if (isPageviewEvent(e)) {
      window.applicationInsights.trackPageView?.();
    }

    if (isInteractionEvent(e)) {
      window.applicationInsights.trackEvent?.({
        name: e.payload.interactionName,
        properties: e.payload.properties,
      });
    }
  };

  // Not using Echo buffering, addEvent above sends events to Application Insights as soon as they appear
  flush = () => {};
}
