import { type BuildInfo } from '@grafana/data';
import {
  type EchoBackend,
  EchoEventType,
  type ExperimentViewEchoEvent,
  type InteractionEchoEvent,
  isExperimentViewEvent,
  isInteractionEvent,
  isPageviewEvent,
  type PageviewEchoEvent,
} from '@grafana/runtime';

import { type User } from '../../../context_srv';
import { loadScript } from '../../utils';

type Properties = Record<string, string | boolean | number>;

interface Rudderstack {
  identify: (identifier: string, traits: Properties) => void;
  // load type set to match Rudderstack v3, for global type compatibility with new version.
  load: (
    writeKey: string,
    dataPlaneURL: string,
    options: {
      configUrl?: string;
      destSDKBaseURL?: string;
      storage?: {
        encryption?: {
          version: 'V3' | 'legacy';
        };
        migrate?: boolean;
      };
      queueOptions?: {
        maxAttempts?: number;
      };
      useBeacon?: boolean;
      beaconQueueOptions?: {
        maxItems?: number;
        flushQueueInterval?: number;
      };
    }
  ) => void;
  page: () => void;
  track: (eventName: string, properties?: Record<string, unknown>) => void;
}

type RudderstackPreloadMethod =
  | keyof Rudderstack
  | 'alias'
  | 'group'
  | 'ready'
  | 'reset'
  | 'getAnonymousId'
  | 'setAnonymousId';

declare global {
  interface Window {
    // We say all methods are undefined because we can't be sure they're there
    // and we should be extra cautious
    rudderanalytics?: Partial<Rudderstack> & { length?: number };
  }
}

export interface RudderstackBackendOptions {
  writeKey: string;
  dataPlaneUrl: string;
  buildInfo: BuildInfo;
  user?: User;
  sdkUrl?: string;
  configUrl?: string;
  integrationsUrl?: string;
  batchInterval?: number;
}

export class RudderstackBackend
  implements EchoBackend<PageviewEchoEvent | InteractionEchoEvent | ExperimentViewEchoEvent, RudderstackBackendOptions>
{
  supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction, EchoEventType.ExperimentView];

  constructor(public options: RudderstackBackendOptions) {
    const url = options.sdkUrl || `https://cdn.rudderlabs.com/v1/rudder-analytics.min.js`;
    loadScript(url);

    const tempRudderstack: unknown[] & Partial<Record<RudderstackPreloadMethod, () => void>> = (window.rudderanalytics =
      []);

    const methods: RudderstackPreloadMethod[] = [
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
      tempRudderstack[method] = (function (methodName) {
        return function () {
          tempRudderstack.push([methodName].concat(Array.prototype.slice.call(arguments)));
        };
      })(method);
    }

    window.rudderanalytics?.load?.(options.writeKey, options.dataPlaneUrl, {
      configUrl: options.configUrl,
      destSDKBaseURL: options.integrationsUrl,
    });

    if (options.user) {
      const { identifier } = options.user.analytics;

      window.rudderanalytics?.identify?.(identifier, {
        email: options.user.email,
        orgId: options.user.orgId,
        language: options.user.language,
        version: options.buildInfo.version,
        edition: options.buildInfo.edition,
      });
    }
  }

  addEvent = (e: PageviewEchoEvent | InteractionEchoEvent | ExperimentViewEchoEvent) => {
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
