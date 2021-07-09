import $ from 'jquery';
import { EchoBackend, EchoEventType, isInteractionEvent, isPageviewEvent, PageviewEchoEvent } from '@grafana/runtime';
import { User } from '../sentry/types';

export interface RudderstackBackendOptions {
  writeKey: string;
  dataPlaneUrl: string;
  user?: User;
}

export class RudderstackBackend implements EchoBackend<PageviewEchoEvent, RudderstackBackendOptions> {
  supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction];

  constructor(public options: RudderstackBackendOptions) {
    const url = `https://cdn.rudderlabs.com/v1/rudder-analytics.min.js`;

    $.ajax({
      url,
      dataType: 'script',
      cache: true,
    });

    const rds = ((window as any).rudderanalytics = []);

    var methods = [
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

    (rds as any).load(options.writeKey, options.dataPlaneUrl);

    if (options.user) {
      (rds as any).identify(String(options.user.id), {
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
  };

  // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
  flush = () => {};
}
