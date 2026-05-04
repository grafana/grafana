import {
  type EchoBackend,
  type EchoEvent,
  EchoEventType,
  isExperimentViewEvent,
  isInteractionEvent,
  isPageviewEvent,
  type PageviewEchoEvent,
} from '@grafana/runtime';

import { type User } from '../../../context_srv';
import { loadScript } from '../../utils';

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

interface PostHog {
  __loaded?: boolean;
  init: (token: string, options: { api_host: string }) => void;
  identify: (identifier: string, properties?: Record<string, unknown>) => void;
  capture: (eventName: string, properties?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    posthog?: Partial<PostHog>;
  }
}

export interface PostHogBackendOptions {
  postHogToken: string;
  postHogHost?: string;
  user?: User;
}

export class PostHogBackend implements EchoBackend<PageviewEchoEvent, PostHogBackendOptions> {
  supportedEvents = [
    EchoEventType.Pageview,
    EchoEventType.Interaction,
    EchoEventType.ExperimentView,
    EchoEventType.Performance,
    EchoEventType.MetaAnalytics,
    EchoEventType.GrafanaJavascriptAgent,
  ];

  constructor(public options: PostHogBackendOptions) {
    const apiHost = options.postHogHost || DEFAULT_POSTHOG_HOST;

    if (!(window.posthog && window.posthog.__loaded)) {
      // loadScript is not awaited (constructors can't be async), so init/identify/capture
      // are called before the SDK has loaded. These stubs queue calls for the real SDK to replay.
      const tempPosthog: any[] = ((window as Record<string, any>).posthog = []);
      for (const method of ['init', 'identify', 'capture']) {
        (tempPosthog as Record<string, any>)[method] = function (...args: unknown[]) {
          tempPosthog.push([method, ...args]);
        };
      }

      loadScript(`${apiHost}/static/array.js`, true);
    }

    window.posthog?.init?.(options.postHogToken, { api_host: apiHost });

    if (options.user) {
      window.posthog?.identify?.(options.user.analytics.identifier, {
        email: options.user.email,
        name: options.user.name,
        orgId: options.user.orgId,
        orgName: options.user.orgName,
        orgRole: options.user.orgRole,
      });
    }
  }

  addEvent = (e: EchoEvent) => {
    if (!window.posthog) {
      return;
    }

    if (isPageviewEvent(e)) {
      window.posthog.capture?.('$pageview', { path: e.payload.page });
      return;
    }

    if (isInteractionEvent(e)) {
      window.posthog.capture?.(e.payload.interactionName, e.payload.properties);
      return;
    }

    if (isExperimentViewEvent(e)) {
      window.posthog.capture?.('experiment_viewed', {
        experiment_id: e.payload.experimentId,
        experiment_group: e.payload.experimentGroup,
        experiment_variant: e.payload.experimentVariant,
      });
      return;
    }

    if (e.type === EchoEventType.MetaAnalytics) {
      window.posthog.capture?.(e.payload.eventName, e.payload);
      return;
    }

    if (e.type === EchoEventType.Performance) {
      window.posthog.capture?.('performance_metric', {
        metric_name: e.payload.name,
        metric_value: e.payload.value,
      });
      return;
    }

    if (e.type === EchoEventType.GrafanaJavascriptAgent) {
      window.posthog.capture?.('grafana_javascript_agent_event', e.payload);
      return;
    }
  };

  // Not using Echo buffering, addEvent above sends events to PostHog as soon as they appear
  flush = () => {};
}
