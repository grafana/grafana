import { BuildInfo, CurrentUserDTO } from '@grafana/data';
import {
  EchoBackend,
  EchoEventType,
  isExperimentViewEvent,
  isInteractionEvent,
  isPageviewEvent,
  PageviewEchoEvent,
} from '@grafana/runtime';

import { loadScript } from '../../utils';

type Properties = Record<string, string | boolean | number>;

interface RudderstackAPIOptions {
  Intercom?: {
    user_hash: string;
  };
}

interface Rudderstack {
  identify: (identifier: string, traits: Properties, options?: RudderstackAPIOptions) => void;
  load: (writeKey: string, dataPlaneURL: string, options: { configUrl?: string; destSDKBaseURL?: string }) => void;
  page: () => void;
  track: (eventName: string, properties?: Properties) => void;
}

declare global {
  interface Window {
    // We say all methods are undefined because we can't be sure they're there
    // and we should be extra cautious
    rudderanalytics?: Partial<Rudderstack>;
  }
}

export interface RudderstackBackendOptions {
  writeKey: string;
  dataPlaneUrl: string;
  buildInfo: BuildInfo;
  user?: CurrentUserDTO;
  sdkUrl?: string;
  configUrl?: string;
  integrationsUrl?: string;
}

export class RudderstackBackend implements EchoBackend<PageviewEchoEvent, RudderstackBackendOptions> {
  supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction, EchoEventType.ExperimentView];

  constructor(public options: RudderstackBackendOptions) {
    const url = options.sdkUrl || `https://cdn.rudderlabs.com/v1/rudder-analytics.min.js`;
    loadScript(url);

    const tempRudderstack = ((window as any).rudderanalytics = []);

    const methods = [
      'load',
      'page',
      'track',
      'identify',
      'alias',
      'group',
      'ready',
      'reset',
      'getAnonymousId',
      'setAnonymousId',
    ];

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      (tempRudderstack as Record<string, any>)[method] = (function (methodName) {
        return function () {
          // @ts-ignore
          tempRudderstack.push([methodName].concat(Array.prototype.slice.call(arguments)));
        };
      })(method);
    }

    window.rudderanalytics?.load?.(options.writeKey, options.dataPlaneUrl, {
      configUrl: options.configUrl,
      destSDKBaseURL: options.integrationsUrl,
    });

    if (options.user) {
      const { identifier, intercomIdentifier } = options.user.analytics;
      const apiOptions: RudderstackAPIOptions = {};

      if (intercomIdentifier) {
        apiOptions.Intercom = {
          user_hash: intercomIdentifier,
        };
      }

      window.rudderanalytics?.identify?.(
        identifier,
        {
          email: options.user.email,
          orgId: options.user.orgId,
          language: options.user.language,
          version: options.buildInfo.version,
          edition: options.buildInfo.edition,
        },
        apiOptions
      );
    }
  }

  addEvent = (e: PageviewEchoEvent) => {
    if (!window.rudderanalytics) {
      return;
    }

    if (isPageviewEvent(e)) {
      window.rudderanalytics.page?.();
    }

    if (isInteractionEvent(e)) {
      window.rudderanalytics.track?.(e.payload.interactionName, e.payload.properties);
    }

    if (isExperimentViewEvent(e)) {
      window.rudderanalytics.track?.('experiment_viewed', {
        experiment_id: e.payload.experimentId,
        experiment_group: e.payload.experimentGroup,
        experiment_variant: e.payload.experimentVariant,
      });
    }
  };

  // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
  flush = () => {};
}
