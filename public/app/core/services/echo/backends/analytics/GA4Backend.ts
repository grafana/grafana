import $ from 'jquery';

import { EchoBackend, EchoEventType, PageviewEchoEvent } from '@grafana/runtime';

export interface GA4EchoBackendOptions {
  googleAnalyticsId: string;
}

export class GA4EchoBackend implements EchoBackend<PageviewEchoEvent, GA4EchoBackendOptions> {
  supportedEvents = [EchoEventType.Pageview];
  trackedUserId: number | null = null;

  constructor(public options: GA4EchoBackendOptions) {
    const url = `https://www.googletagmanager.com/gtag/js?id=${options.googleAnalyticsId}`;

    $.ajax({
      url,
      dataType: 'script',
      cache: true,
    });

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', options.googleAnalyticsId, {
      user_id: userId,
    });
  }

  addEvent = (e: PageviewEchoEvent) => {
    if (!window.gtag) {
      return;
    }

    window.gtag('set', 'page_path', e.payload.page);
    window.gtag('event', 'page_view');

    const { userSignedIn, userId } = e.meta;
    if (userSignedIn && userId !== this.trackedUserId) {
      this.trackedUserId = userId;
      window.gtag('set', 'userId', userId);
    }
  };

  // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
  flush = () => {};
}
