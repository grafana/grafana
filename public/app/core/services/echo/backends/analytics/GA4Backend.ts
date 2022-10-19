import { CurrentUserDTO } from '@grafana/data';
import { EchoBackend, EchoEventType, PageviewEchoEvent } from '@grafana/runtime';

import { getUserIdentifier, loadScript } from '../../utils';

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

export interface GA4EchoBackendOptions {
  googleAnalyticsId: string;
  user?: CurrentUserDTO;
}

export class GA4EchoBackend implements EchoBackend<PageviewEchoEvent, GA4EchoBackendOptions> {
  supportedEvents = [EchoEventType.Pageview];
  trackedUserId: number | null = null;

  constructor(public options: GA4EchoBackendOptions) {
    const url = `https://www.googletagmanager.com/gtag/js?id=${options.googleAnalyticsId}`;
    loadScript(url);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());

    const configOptions: Gtag.CustomParams = {};

    if (options.user) {
      configOptions.user_id = getUserIdentifier(options.user);
    }

    window.gtag('config', options.googleAnalyticsId, configOptions);
  }

  addEvent = (e: PageviewEchoEvent) => {
    if (!window.gtag) {
      return;
    }

    window.gtag('set', 'page_path', e.payload.page);
    window.gtag('event', 'page_view');
  };

  // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
  flush = () => {};
}
