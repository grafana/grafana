import { BuildInfo } from '@grafana/data';
import {
  EchoBackend,
  EchoEventType,
  isExperimentViewEvent,
  isInteractionEvent,
  isPageviewEvent,
  PageviewEchoEvent,
} from '@grafana/runtime';

import { User } from '../../../context_srv';
import { loadScript } from '../../utils';

type Properties = Record<string, string | boolean | number>;

interface RudderstackAPIOptions {
  Intercom?: {
    user_hash: string;
  };
}

interface Rudderstack {
  identify: (identifier: string, traits: Properties, options?: RudderstackAPIOptions) => void;
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
    }
  ) => void;
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
  user?: User;
  sdkUrl?: string;
  configUrl?: string;
  integrationsUrl?: string;
}

export class RudderstackBackend implements EchoBackend<PageviewEchoEvent, RudderstackBackendOptions> {
  supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction, EchoEventType.ExperimentView];

  constructor(public options: RudderstackBackendOptions) {
    const url = options.sdkUrl || `https://cdn.rudderlabs.com/v3/modern/rsa.min.js`;
    loadScript(url);

    // this preloadRudderstack functionality is mirror the loading snippet reference in the Rudderstack
    // docs here: https://www.rudderstack.com/docs/sources/event-streams/sdks/rudderstack-javascript-sdk/installation/#using-cdn
    // We don't need a bunch of what's in the snippet, and we can rely on browser support being modern,
    // so this is much more terse and only needs to handle the temp setup that pushes calls to the
    // rudderstack API into the temp array.
    const preloadRudderstack: unknown[] = [];

    const methodNames = [
      'setDefaultInstanceKey',
      'load',
      'ready',
      'page',
      'track',
      'identify',
      'alias',
      'group',
      'reset',
      'setAnonymousId',
      'startSession',
      'endSession',
      'consent',
      'addCustomIntegration',
    ];

    methodNames.forEach((methodName) => {
      // using Object.assign gets around the types being "wrong".
      Object.assign(preloadRudderstack, {
        [methodName]: function () {
          preloadRudderstack.push([methodName].concat(Array.prototype.slice.call(arguments)));
        },
      });
    });

    Object.assign(window, { rudderanalytics: preloadRudderstack });

    window.rudderanalytics?.load?.(options.writeKey, options.dataPlaneUrl, {
      configUrl: options.configUrl,
      destSDKBaseURL: options.integrationsUrl,
      // these storage settings allow backwards compat across subdomains with the older rudderstack
      // version. This would have to be changed to the new setting across all instances at once,
      // and wouldn't be able to be rolled back.
      storage: {
        encryption: {
          version: 'legacy',
        },
        migrate: false,
      },
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

    window.rudderanalytics?.page?.();
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
