import $ from 'jquery';

import { CurrentUserDTO } from '@grafana/data';
import {
  EchoBackend,
  EchoEventType,
  isExperimentViewEvent,
  isInteractionEvent,
  isPageviewEvent,
  PageviewEchoEvent,
} from '@grafana/runtime';

import { getUserIdentifier } from '../../utils';

export interface RudderstackBackendOptions {
  writeKey: string;
  dataPlaneUrl: string;
  user?: CurrentUserDTO;
  sdkUrl?: string;
  configUrl?: string;
}

export class RudderstackBackend implements EchoBackend<PageviewEchoEvent, RudderstackBackendOptions> {
  supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction, EchoEventType.ExperimentView];

  constructor(public options: RudderstackBackendOptions) {
    const url = options.sdkUrl || `https://cdn.rudderlabs.com/v1/rudder-analytics.min.js`;

    $.ajax({
      url,
      dataType: 'script',
      cache: true,
    });

    const rds = ((window as any).rudderanalytics = []);

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
      (rds as Record<string, any>)[method] = (function (methodName) {
        return function () {
          // @ts-ignore
          rds.push([methodName].concat(Array.prototype.slice.call(arguments)));
        };
      })(method);
    }

    (rds as any).load(options.writeKey, options.dataPlaneUrl, { configUrl: options.configUrl });

    if (options.user) {
      const identifier = getUserIdentifier(options.user);

      (rds as any).identify(identifier, {
        email: options.user.email,
        orgId: options.user.orgId,
      });
    }
  }

  addEvent = (e: PageviewEchoEvent) => {
    if (!(window as any).rudderanalytics) {
      return;
    }

    if (isPageviewEvent(e)) {
      (window as any).rudderanalytics.page();
    }

    if (isInteractionEvent(e)) {
      (window as any).rudderanalytics.track(e.payload.interactionName, e.payload.properties);
    }

    if (isExperimentViewEvent(e)) {
      (window as any).rudderanalytics.track('experiment_viewed', {
        experiment_id: e.payload.experimentId,
        experiment_group: e.payload.experimentGroup,
        experiment_variant: e.payload.experimentVariant,
      });
    }
  };

  // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
  flush = () => {};
}
