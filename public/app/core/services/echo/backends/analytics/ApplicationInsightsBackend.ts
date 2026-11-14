import {
  type EchoBackend,
  EchoEventType,
  type InteractionEchoEvent,
  isInteractionEvent,
  isPageviewEvent,
  type PageviewEchoEvent,
} from '@grafana/runtime';

import { type User } from '../../../context_srv';

interface ApplicationInsights {
  trackPageView: () => void;
  trackEvent: (event: { name: string; properties?: Record<string, unknown> }) => void;
  setAuthenticatedUserContext: (authenticatedUserId: string, accountId?: string, storeInCookie?: boolean) => void;
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
  autoRouteTracking?: boolean;
  user?: User;
}

export class ApplicationInsightsBackend implements EchoBackend<PageviewEchoEvent, ApplicationInsightsBackendOptions> {
  supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction];

  constructor(public options: ApplicationInsightsBackendOptions) {
    const applicationInsightsOpts = {
      config: {
        connectionString: options.connectionString,
        endpointUrl: options.endpointUrl,
        enableAutoRouteTracking: options.autoRouteTracking,
      },
    };

    const url = 'https://js.monitor.azure.com/scripts/b/ai.2.min.js';
    System.import(url)
      .then((m) => (m.default ? m.default : m))
      .then(({ ApplicationInsights }) => {
        const init = new ApplicationInsights(applicationInsightsOpts);
        const insights = init.loadAppInsights();
        window.applicationInsights = insights;
        const userId = options.user?.uid;
        if (userId) {
          insights?.setAuthenticatedUserContext?.(userId);
        }
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
