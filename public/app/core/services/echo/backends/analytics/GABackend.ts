import $ from 'jquery';
import { EchoBackend, EchoEventType, PageviewEchoEvent } from '@grafana/runtime';

export interface GAEchoBackendOptions {
  googleAnalyticsId: string;
  debug?: boolean;
}

export class GAEchoBackend implements EchoBackend<PageviewEchoEvent, GAEchoBackendOptions> {
  supportedEvents = [EchoEventType.Pageview];
  trackedUserId: number | null = null;

  constructor(public options: GAEchoBackendOptions) {
    const url = `https://www.google-analytics.com/analytics${options.debug ? '_debug' : ''}.js`;

    $.ajax({
      url,
      dataType: 'script',
      cache: true,
    });

    const ga = (window.ga =
      window.ga ||
      // this had the equivalent of `eslint-disable-next-line prefer-arrow/prefer-arrow-functions`
      function () {
        (ga.q = ga.q || []).push(arguments);
      });
    ga.l = +new Date();
    ga('create', options.googleAnalyticsId, 'auto');
    ga('set', 'anonymizeIp', true);
  }

  addEvent = (e: PageviewEchoEvent) => {
    if (!window.ga) {
      return;
    }

    window.ga('set', { page: e.payload.page });
    window.ga('send', 'pageview');

    const { userSignedIn, userId } = e.meta;
    if (userSignedIn && userId !== this.trackedUserId) {
      this.trackedUserId = userId;
      window.ga('set', 'userId', userId);
    }
  };

  // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
  flush = () => {};
}
