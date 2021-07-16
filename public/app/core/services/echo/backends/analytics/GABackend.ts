import $ from 'jquery';
import { EchoBackend, EchoEventType, PageviewEchoEvent } from '@grafana/runtime';

export interface GAEchoBackendOptions {
  googleAnalyticsId: string;
  debug?: boolean;
}

export class GAEchoBackend implements EchoBackend<PageviewEchoEvent, GAEchoBackendOptions> {
  supportedEvents = [EchoEventType.Pageview];

  constructor(public options: GAEchoBackendOptions) {
    const url = `https://www.google-analytics.com/analytics${options.debug ? '_debug' : ''}.js`;

    $.ajax({
      url,
      dataType: 'script',
      cache: true,
    });

    const ga = ((window as any).ga =
      (window as any).ga ||
      // this had the equivalent of `eslint-disable-next-line prefer-arrow/prefer-arrow-functions`
      function () {
        (ga.q = ga.q || []).push(arguments);
      });
    ga.l = +new Date();
    ga('create', options.googleAnalyticsId, 'auto');
    ga('set', 'anonymizeIp', true);
  }

  addEvent = (e: PageviewEchoEvent) => {
    if (!(window as any).ga) {
      return;
    }

    (window as any).ga('set', { page: e.payload.page });
    (window as any).ga('send', 'pageview');
  };

  // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
  flush = () => {};
}
