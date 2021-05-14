import $ from 'jquery';
import config from 'app/core/config';
import { locationService } from '@grafana/runtime';

export class Analytics {
  private gaId?: string;
  private ga?: any;

  constructor() {
    this.track = this.track.bind(this);
    this.gaId = (config as any).googleAnalyticsId;
    this.init();
  }

  init() {
    if (!this.gaId) {
      return;
    }

    $.ajax({
      url: 'https://www.google-analytics.com/analytics.js',
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
    ga('create', (config as any).googleAnalyticsId, 'auto');
    ga('set', 'anonymizeIp', true);
    this.ga = ga;
    return ga;
  }

  track() {
    if (!this.ga) {
      return;
    }

    const location = locationService.getLocation();
    const track = { page: `${config.appSubUrl ?? ''}${location.pathname}${location.search}${location.hash}` };

    this.ga('set', track);
    this.ga('send', 'pageview');
  }
}

export const analyticsService = new Analytics();
